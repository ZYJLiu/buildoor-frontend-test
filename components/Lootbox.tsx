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
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js"
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
        [publicKey!.toBytes(), vrfKeypair.publicKey.toBytes()],
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
            escrow,
            authority: userState,
            oracleQueue: queueAccount.publicKey,
            programState: programStateAccount.publicKey,
            tokenProgram: spl.TOKEN_PROGRAM_ID,
          })
          .instruction(),
        // create permission account
        // await programSwitchboard.methods
        //   .permissionInit({})
        //   .accounts({
        //     permission: permissionAccount.publicKey,
        //     authority: queueState.authority,
        //     granter: queueAccount.publicKey,
        //     grantee: vrfKeypair.publicKey,
        //     payer: publicKey!,
        //     systemProgram: anchor.web3.SystemProgram.programId,
        //   })
        //   .instruction(),
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
        // await programLootbox!.methods
        //   .requestRandomness()
        //   .accounts({
        //     state: userState,
        //     vrf: vrfKeypair.publicKey,
        //     oracleQueue: queueAccount.publicKey,
        //     queueAuthority: queueState.authority,
        //     dataBuffer: queueState.dataBuffer,
        //     permission: permissionAccount.publicKey,
        //     escrow: escrow,
        //     programState: programStateAccount.publicKey,
        //     switchboardProgram: programSwitchboard.programId,
        //     payerWallet: publicKey!,
        //     payer: publicKey!,
        //     recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
        //     stakeMint: STAKE_MINT,
        //     stakeTokenAccount: stakeTokenAccount,
        //     tokenProgram: spl.TOKEN_PROGRAM_ID,
        //   })
        //   .instruction(),
      ]

      // const tx = await programSwitchboard.methods
      //   .vrfInit({
      //     stateBump,
      //     callback: {
      //       programId: programLootbox!.programId,
      //       accounts: [
      //         { pubkey: userState, isSigner: false, isWritable: true },
      //         {
      //           pubkey: vrfKeypair.publicKey,
      //           isSigner: false,
      //           isWritable: false,
      //         },
      //         { pubkey: lootbox, isSigner: false, isWritable: false },
      //         { pubkey: publicKey!, isSigner: false, isWritable: false },
      //       ],
      //       ixData: new anchor.BorshInstructionCoder(
      //         programLootbox!.idl
      //       ).encode("consumeRandomness", ""),
      //     },
      //   })
      //   .accounts({
      //     vrf: vrfKeypair.publicKey,
      //     escrow,
      //     authority: userState,
      //     oracleQueue: queueAccount.publicKey,
      //     programState: programStateAccount.publicKey,
      //     tokenProgram: spl.TOKEN_PROGRAM_ID,
      //   })
      //   .preInstructions([
      //     spl.createAssociatedTokenAccountInstruction(
      //       publicKey!,
      //       escrow,
      //       vrfKeypair.publicKey,
      //       switchTokenMint.address
      //     ),
      //     spl.createSetAuthorityInstruction(
      //       escrow,
      //       vrfKeypair.publicKey,
      //       spl.AuthorityType.AccountOwner,
      //       programStateAccount.publicKey,
      //       [vrfKeypair]
      //     ),
      //     anchor.web3.SystemProgram.createAccount({
      //       fromPubkey: publicKey!,
      //       newAccountPubkey: vrfKeypair.publicKey,
      //       space: size,
      //       lamports:
      //         await programSwitchboard.provider.connection.getMinimumBalanceForRentExemption(
      //           size
      //         ),
      //       programId: programSwitchboard.programId,
      //     }),
      //   ])
      //   .signers([vrfKeypair])
      //   .transaction()

      // console.log(ix)

      const tx = new Transaction().add(...txnIxns)

      const sig = await sendTransaction(tx, connection, {
        signers: [vrfKeypair],
      })

      console.log(sig)

      // const tx = await programSwitchboard.methods
      //   .vrfInit({
      //     stateBump,
      //     callback: {
      //       programId: programLootbox!.programId,
      //       accounts: [
      //         { pubkey: userState, isSigner: false, isWritable: true },
      //         {
      //           pubkey: vrfKeypair.publicKey,
      //           isSigner: false,
      //           isWritable: false,
      //         },
      //         { pubkey: lootbox, isSigner: false, isWritable: false },
      //         { pubkey: publicKey!, isSigner: false, isWritable: false },
      //       ],
      //       ixData: new anchor.BorshInstructionCoder(
      //         programLootbox!.idl
      //       ).encode("consumeRandomness", ""),
      //     },
      //   })
      //   .accounts({
      //     vrf: vrfKeypair.publicKey,
      //     escrow,
      //     authority: userState,
      //     oracleQueue: queueAccount.publicKey,
      //     programState: programStateAccount.publicKey,
      //     tokenProgram: spl.TOKEN_PROGRAM_ID,
      //   })
      //   .preInstructions([
      //     spl.createAssociatedTokenAccountInstruction(
      //       publicKey!,
      //       escrow,
      //       vrfKeypair.publicKey,
      //       switchTokenMint.address
      //     ),
      //     spl.createSetAuthorityInstruction(
      //       escrow,
      //       vrfKeypair.publicKey,
      //       spl.AuthorityType.AccountOwner,
      //       programStateAccount.publicKey,
      //       [vrfKeypair]
      //     ),
      //     anchor.web3.SystemProgram.createAccount({
      //       fromPubkey: publicKey!,
      //       newAccountPubkey: vrfKeypair.publicKey,
      //       space: size,
      //       lamports:
      //         await programSwitchboard.provider.connection.getMinimumBalanceForRentExemption(
      //           size
      //         ),
      //       programId: programSwitchboard.programId,
      //     }),
      //   ])
      //   .signers([vrfKeypair])
      //   .transaction()
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
        [publicKey!.toBytes(), vrfKeypair.publicKey.toBytes()],
        programLootbox!.programId
      )

      const state = await programLootbox!.account.userState.fetch(userState)
      const vrfAccount = new VrfAccount({
        program: programSwitchboard,
        publicKey: state.vrf,
      })

      console.log("vrf account", vrfAccount.publicKey.toString())

      const vrfState = await vrfAccount.loadData()

      const queueAccount = new OracleQueueAccount({
        program: programSwitchboard,
        publicKey: vrfState.oracleQueue,
      })
      const queueState = await queueAccount.loadData()
      const switchTokenMint = await queueAccount.loadMint()

      console.log(queueAccount.publicKey.toString())
      console.log(queueState.authority.toString())

      const [permissionAccount, permissionBump] = PermissionAccount.fromSeed(
        programSwitchboard,
        queueState.authority,
        queueAccount.publicKey,
        vrfKeypair.publicKey
      )

      console.log(permissionAccount.publicKey.toString())

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

      // const account = await getAccount(connection, wrappedTokenAccount)
      // console.log(account.amount)

      console.log(programSwitchboard.programId.toString())

      const tx = await programLootbox!.methods
        .requestRandomness()
        .accounts({
          state: userState,
          vrf: vrfAccount.publicKey,
          oracleQueue: queueAccount.publicKey,
          queueAuthority: queueState.authority,
          dataBuffer: queueState.dataBuffer,
          permission: permissionAccount.publicKey,
          escrow: vrfState.escrow,
          programState: programStateAccount.publicKey,
          switchboardProgram: programSwitchboard.programId,
          payerWallet: wrappedTokenAccount,
          payer: publicKey!,
          recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
          stakeMint: STAKE_MINT,
          stakeTokenAccount: stakeTokenAccount,
          tokenProgram: spl.TOKEN_PROGRAM_ID,
        })
        .transaction()

      // const tx = new Transaction().add(...txnIxns)

      // const sig = await sendTransaction(tx, connection)
      // console.log(sig)
    }
  }

  const switchboard = async () => {
    // const IDL = await anchor.Program.fetchIdl(SBV2_DEVNET_PID, provider)
    // console.log(IDL)
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
    []
  )

  const request: MouseEventHandler<HTMLButtonElement> = useCallback(
    async (event) => {
      if (event.defaultPrevented) return
      switchboard()
      requestRandomness()
    },
    []
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
    </VStack>
  )
}

export default Lootbox
