import {
  Button,
  Container,
  Heading,
  VStack,
  Text,
  HStack,
  Image,
} from "@chakra-ui/react"
import {
  FC,
  MouseEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import {
  Metaplex,
  walletAdapterIdentity,
  CandyMachine,
} from "@metaplex-foundation/js"
import { useRouter } from "next/router"
import { useWorkspace } from "../context/Anchor"
import {
  SwitchboardTestContext,
  promiseWithTimeout,
} from "@switchboard-xyz/sbv2-utils"
import {
  Callback,
  packTransactions,
  PermissionAccount,
  ProgramStateAccount,
  programWallet,
  VrfAccount,
  OracleQueueAccount,
} from "@switchboard-xyz/switchboard-v2"
import * as spl from "@solana/spl-token"
import * as anchor from "@project-serum/anchor"
import { program } from "@project-serum/anchor/dist/cjs/spl/associated-token"
import { STAKE_MINT } from "../utils/constants"
import {
  getAssociatedTokenAddress,
  NATIVE_MINT,
  getAccount,
} from "@solana/spl-token"
import { Lootbox, IDL as LootboxIDL } from "../context/Anchor/lootbox"
import { Program } from "@project-serum/anchor"

const Lootbox: FC = () => {
  const { connection } = useConnection()
  const [vrfKeypair, setSwitchboardPID] = useState(new anchor.web3.Keypair())
  const walletAdapter = useWallet()
  const { publicKey, sendTransaction } = useWallet()
  const workspace = useWorkspace()
  const programLootbox = workspace.programLootbox
  const programSwitchboard = workspace.programSwitchboard
  const provider = workspace.provider

  const router = useRouter()

  // const vrfKeypair = anchor.web3.Keypair.generate()
  // console.log("vrf", vrfKeypair.publicKey.toString())

  const setup = async () => {
    if (programSwitchboard) {
      console.log("vrf", vrfKeypair.publicKey.toString())

      const [programStateAccount, stateBump] =
        ProgramStateAccount.fromSeed(programSwitchboard)
      // keypair for vrf account

      const queueAccount = new OracleQueueAccount({
        program: programSwitchboard,
        // devnet permissionless queue
        publicKey: new PublicKey(
          "F8ce7MsckeZAbAGmxjJNetxYXQa9mKr9nnrC3qKubyYy"
        ),
      })

      const queueState = await queueAccount.loadData()

      const size = programSwitchboard.account.vrfAccountData.size
      const switchTokenMint = await queueAccount.loadMint()

      const escrow = await spl.getAssociatedTokenAddress(
        switchTokenMint.address,
        vrfKeypair.publicKey,
        true
      )

      // find PDA used for our client state pubkey
      const [userState, userStateBump] = await PublicKey.findProgramAddress(
        [publicKey!.toBytes()],
        programLootbox!.programId
      )
      const [lootbox] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("LOOTBOX")],
        programLootbox!.programId
      )

      const [permissionAccount, permissionBump] = PermissionAccount.fromSeed(
        programSwitchboard,
        queueState.authority,
        queueAccount.publicKey,
        vrfKeypair.publicKey
      )

      const stakeTokenAccount = await getAssociatedTokenAddress(
        STAKE_MINT,
        publicKey!
      )

      const txnIxns: TransactionInstruction[] = [
        spl.createAssociatedTokenAccountInstruction(
          publicKey!,
          escrow,
          vrfKeypair.publicKey,
          switchTokenMint.address
        ),
        spl.createSetAuthorityInstruction(
          escrow,
          vrfKeypair.publicKey,
          spl.AuthorityType.AccountOwner,
          programStateAccount.publicKey,
          [vrfKeypair]
        ),
        anchor.web3.SystemProgram.transfer({
          fromPubkey: publicKey!,
          toPubkey: escrow,
          lamports: 0.02 * LAMPORTS_PER_SOL,
        }),
        // sync wrapped SOL balance
        spl.createSyncNativeInstruction(escrow),
        anchor.web3.SystemProgram.createAccount({
          fromPubkey: publicKey!,
          newAccountPubkey: vrfKeypair.publicKey,
          space: size,
          lamports:
            await programSwitchboard.provider.connection.getMinimumBalanceForRentExemption(
              size
            ),
          programId: programSwitchboard.programId,
        }),
        await programSwitchboard.methods
          .vrfInit({
            stateBump,
            callback: {
              programId: programLootbox!.programId,
              accounts: [
                { pubkey: userState, isSigner: false, isWritable: true },
                {
                  pubkey: vrfKeypair.publicKey,
                  isSigner: false,
                  isWritable: false,
                },
                { pubkey: lootbox, isSigner: false, isWritable: false },
                { pubkey: publicKey!, isSigner: false, isWritable: false },
              ],
              ixData: new anchor.BorshInstructionCoder(
                programLootbox!.idl
              ).encode("consumeRandomness", ""),
            },
          })
          .accounts({
            vrf: vrfKeypair.publicKey,
            escrow: escrow,
            authority: userState,
            oracleQueue: queueAccount.publicKey,
            programState: programStateAccount.publicKey,
            tokenProgram: spl.TOKEN_PROGRAM_ID,
          })
          .instruction(),
        // create permission account
        await programSwitchboard.methods
          .permissionInit({})
          .accounts({
            permission: permissionAccount.publicKey,
            authority: queueState.authority,
            granter: queueAccount.publicKey,
            grantee: vrfKeypair.publicKey,
            payer: publicKey!,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .instruction(),
        await programLootbox!.methods
          .initUser({
            switchboardStateBump: stateBump,
            vrfPermissionBump: permissionBump,
          })
          .accounts({
            state: userState,
            vrf: vrfKeypair.publicKey,
            payer: publicKey!,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .instruction(),
      ]

      const tx = new Transaction().add(...txnIxns)

      const transactionSignature = await sendTransaction(tx, connection, {
        signers: [vrfKeypair],
      })

      console.log(
        `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
      )
    }
  }

  const requestRandomness = async () => {
    if (programSwitchboard) {
      console.log("vrf", vrfKeypair.publicKey.toString())

      // const [programStateAccount, stateBump] =
      //   ProgramStateAccount.fromSeed(programSwitchboard)
      // keypair for vrf account

      // const queueAccount = new OracleQueueAccount({
      //   program: programSwitchboard,
      //   // devnet permissionless queue
      //   publicKey: new PublicKey(
      //     "F8ce7MsckeZAbAGmxjJNetxYXQa9mKr9nnrC3qKubyYy"
      //   ),
      // })

      // const queueState = await queueAccount.loadData()

      // const size = programSwitchboard.account.vrfAccountData.size
      // const switchTokenMint = await queueAccount.loadMint()

      // const escrow = await spl.getAssociatedTokenAddress(
      //   switchTokenMint.address,
      //   vrfKeypair.publicKey,
      //   true
      // )

      // find PDA used for our client state pubkey
      const [userState, userStateBump] = await PublicKey.findProgramAddress(
        [publicKey!.toBytes()],
        programLootbox!.programId
      )

      // const state = await programLootbox!.account.userState.fetch(userState)
      // const vrfAccount = new VrfAccount({
      //   program: programSwitchboard,
      //   publicKey: vrfKeypair.publicKey,
      // })

      // console.log("vrf account", vrfAccount.publicKey.toString())

      // const vrfState = await vrfAccount.loadData()

      const queueAccount = new OracleQueueAccount({
        program: programSwitchboard,
        publicKey: new PublicKey(
          "F8ce7MsckeZAbAGmxjJNetxYXQa9mKr9nnrC3qKubyYy"
        ),
      })
      const queueState = await queueAccount.loadData()
      const switchTokenMint = await queueAccount.loadMint()

      // console.log(queueAccount.publicKey.toString())
      // console.log(queueState.authority.toString())

      const [permissionAccount, permissionBump] = PermissionAccount.fromSeed(
        programSwitchboard,
        queueState.authority,
        queueAccount.publicKey,
        vrfKeypair.publicKey
      )

      // console.log(permissionAccount.publicKey.toString())

      const [programStateAccount, switchboardStateBump] =
        ProgramStateAccount.fromSeed(programSwitchboard)

      const stakeTokenAccount = await getAssociatedTokenAddress(
        STAKE_MINT,
        publicKey!
      )

      const wrappedTokenAccount = await getAssociatedTokenAddress(
        switchTokenMint.address,
        publicKey!
      )

      const escrow = await spl.getAssociatedTokenAddress(
        switchTokenMint.address,
        vrfKeypair.publicKey,
        true
      )

      // const account = await getAccount(connection, wrappedTokenAccount)
      // console.log(account.amount)

      // console.log(programSwitchboard.programId.toString())
      // console.log("start")
      // console.log(userState.toString())
      // console.log(vrfAccount.publicKey.toString())
      // console.log(queueAccount.publicKey.toString())
      // console.log(queueState.dataBuffer.toString())
      // console.log(permissionAccount.publicKey.toString())
      // console.log(vrfState.escrow.toString())
      // console.log(programStateAccount.publicKey.toString())
      // console.log(programSwitchboard.programId.toString())
      // console.log(wrappedTokenAccount.toString())
      // console.log(publicKey!.toString())
      // console.log(STAKE_MINT.toString())
      // console.log(spl.TOKEN_PROGRAM_ID.toString())
      // console.log(anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY.toString())

      // const txnIxns: TransactionInstruction[] = [
      //   anchor.web3.SystemProgram.transfer({
      //     fromPubkey: publicKey!,
      //     toPubkey: wrappedTokenAccount,
      //     lamports: 1,
      //   }),
      //   // sync wrapped SOL balance
      //   spl.createSyncNativeInstruction(wrappedTokenAccount),
      //   await programLootbox!.methods
      //     .requestRandomness()
      //     .accounts({
      //       state: userState,
      //       vrf: vrfKeypair.publicKey,
      //       oracleQueue: queueAccount.publicKey,
      //       queueAuthority: queueState.authority,
      //       dataBuffer: queueState.dataBuffer,
      //       permission: permissionAccount.publicKey,
      //       escrow: escrow,
      //       programState: programStateAccount.publicKey,
      //       switchboardProgram: programSwitchboard.programId,
      //       payerWallet: wrappedTokenAccount,
      //       payer: publicKey!,
      //       recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
      //       stakeMint: STAKE_MINT,
      //       stakeTokenAccount: stakeTokenAccount,
      //       tokenProgram: spl.TOKEN_PROGRAM_ID,
      //     })
      //     .instruction(),
      // ]

      const txnIxns: TransactionInstruction[] = [
        // anchor.web3.SystemProgram.transfer({
        //   fromPubkey: publicKey!,
        //   toPubkey: wrappedTokenAccount,
        //   lamports: 1,
        // }),
        // // sync wrapped SOL balance
        // spl.createSyncNativeInstruction(wrappedTokenAccount),
        await programLootbox!.methods
          .requestRandomness()
          .accounts({
            state: userState,
            vrf: vrfKeypair.publicKey,
            oracleQueue: queueAccount.publicKey,
            queueAuthority: queueState.authority,
            dataBuffer: queueState.dataBuffer,
            permission: permissionAccount.publicKey,
            escrow: escrow,
            programState: programStateAccount.publicKey,
            switchboardProgram: programSwitchboard.programId,
            payerWallet: wrappedTokenAccount,
            payer: publicKey!,
            recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
            stakeMint: STAKE_MINT,
            stakeTokenAccount: stakeTokenAccount,
            tokenProgram: spl.TOKEN_PROGRAM_ID,
          })
          .instruction(),
      ]

      const tx = new Transaction().add(...txnIxns)

      const transactionSignature = await sendTransaction(tx, connection)
      console.log(
        `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
      )

      const result = await awaitCallback(programLootbox!, userState, 20_000)

      console.log(`Randomness Result: ${result}`)
      const account = await programLootbox!.account.userState.fetch(userState)
      console.log("item mint:", account.mint.toBase58())
    }
  }

  const mintRewards = async () => {
    if (programSwitchboard && programLootbox) {
      const [userState, userStateBump] = await PublicKey.findProgramAddress(
        [publicKey!.toBytes()],
        programLootbox.programId
      )
      const [mintAuth] = await PublicKey.findProgramAddress(
        [Buffer.from("MINT_AUTH")],
        programLootbox.programId
      )

      const state = await programLootbox.account.userState.fetch(userState)

      const tx = await programLootbox.methods
        .mintReward()
        .accounts({
          state: userState,
          mint: state.mint,
          tokenAccount: state.tokenAccount,
          mintAuthority: mintAuth,
          tokenProgram: spl.TOKEN_PROGRAM_ID,
          associatedTokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          systemProgram: anchor.web3.SystemProgram.programId,
          payer: publicKey!,
        })
        .transaction()

      const transactionSignature = await sendTransaction(tx, connection)
      console.log(
        `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
      )
    }
  }

  async function awaitCallback(
    program: Program<Lootbox>,
    vrfClientKey: anchor.web3.PublicKey,
    timeoutInterval: number,
    errorMsg = "Timed out waiting for VRF Client callback"
  ) {
    let ws: number | undefined = undefined
    const result: anchor.BN = await promiseWithTimeout(
      timeoutInterval,
      new Promise((resolve: (result: anchor.BN) => void) => {
        ws = program.provider.connection.onAccountChange(
          vrfClientKey,
          async (
            accountInfo: anchor.web3.AccountInfo<Buffer>,
            context: anchor.web3.Context
          ) => {
            // const clientState = program.account.userState.coder.accounts.decode(
            //   "userState",
            //   accountInfo.data
            // )
            const clientState = await program.account.userState.fetch(
              vrfClientKey
            )
            if (clientState.result.gt(new anchor.BN(0))) {
              resolve(clientState.result)
            }
          }
        )
      }).finally(async () => {
        if (ws) {
          await program.provider.connection.removeAccountChangeListener(ws)
        }
        ws = undefined
      }),
      new Error(errorMsg)
    ).finally(async () => {
      if (ws) {
        await program.provider.connection.removeAccountChangeListener(ws)
      }
      ws = undefined
    })

    return result
  }

  const switchboard = async () => {
    console.log("switchboard", programSwitchboard)
    console.log("lootbox", programLootbox)
  }

  useEffect(() => {
    switchboard()
  }, [])

  const init: MouseEventHandler<HTMLButtonElement> = useCallback(
    async (event) => {
      if (event.defaultPrevented) return
      switchboard()
      setup()
    },
    [programLootbox, programSwitchboard]
  )

  const request: MouseEventHandler<HTMLButtonElement> = useCallback(
    async (event) => {
      if (event.defaultPrevented) return
      switchboard()
      requestRandomness()
    },
    [programLootbox, programSwitchboard]
  )

  const redeem: MouseEventHandler<HTMLButtonElement> = useCallback(
    async (event) => {
      if (event.defaultPrevented) return
      switchboard()
      mintRewards()
    },
    [programLootbox, programSwitchboard]
  )

  return (
    <VStack
      bgColor="containerBg"
      borderRadius="20px"
      padding="20px 40px"
      spacing={5}
    >
      <Image src="avatar1.png" alt="" />
      <Button bgColor="accent" color="white" maxW="380px" onClick={init}>
        <Text>Init</Text>
      </Button>
      <Button bgColor="accent" color="white" maxW="380px" onClick={request}>
        <Text>Request</Text>
      </Button>
      <Button bgColor="accent" color="white" maxW="380px" onClick={redeem}>
        <Text>Redeem</Text>
      </Button>
    </VStack>
  )
}

export default Lootbox
