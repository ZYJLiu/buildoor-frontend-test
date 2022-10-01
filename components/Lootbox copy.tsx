import {
  Button,
  Container,
  Heading,
  VStack,
  Text,
  HStack,
  Image,
} from "@chakra-ui/react"
import { FC, MouseEventHandler, useCallback, useEffect, useState } from "react"
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { useWorkspace } from "../context/Anchor"
import {
  PermissionAccount,
  ProgramStateAccount,
  OracleQueueAccount,
} from "@switchboard-xyz/switchboard-v2"
import * as spl from "@solana/spl-token"
import * as anchor from "@project-serum/anchor"
import { STAKE_MINT } from "../utils/constants"

const Lootbox: FC = () => {
  const { connection } = useConnection()
  const [vrfKeypair] = useState(new anchor.web3.Keypair())
  const [user, setUser] = useState<any>()
  const [isLoading, setIsLoading] = useState(false)
  const [redeemable, setRedeemable] = useState(false)
  const { publicKey, sendTransaction } = useWallet()
  const workspace = useWorkspace()
  const programLootbox = workspace.programLootbox
  const programSwitchboard = workspace.programSwitchboard

  const checkUserAccount = async () => {
    try {
      const [userState] = await PublicKey.findProgramAddress(
        [publicKey!.toBytes()],
        programLootbox!.programId
      )
      const account = await programLootbox!.account.userState.fetch(userState)
      if (account) {
        setUser(account)
        setRedeemable(account.redeemable)
      }
    } catch (e) {}
  }

  const initUser = async () => {
    if (programSwitchboard) {
      const [programStateAccount, stateBump] =
        ProgramStateAccount.fromSeed(programSwitchboard)

      const queueAccount = new OracleQueueAccount({
        program: programSwitchboard,
        // devnet permissionless queue
        publicKey: new PublicKey(
          "F8ce7MsckeZAbAGmxjJNetxYXQa9mKr9nnrC3qKubyYy"
        ),
      })

      const queueState = await queueAccount.loadData()

      const [permissionAccount, permissionBump] = PermissionAccount.fromSeed(
        programSwitchboard,
        queueState.authority,
        queueAccount.publicKey,
        vrfKeypair.publicKey
      )

      const size = programSwitchboard.account.vrfAccountData.size
      const switchTokenMint = await queueAccount.loadMint()

      const escrow = await spl.getAssociatedTokenAddress(
        switchTokenMint.address,
        vrfKeypair.publicKey,
        true
      )

      const [userState] = await PublicKey.findProgramAddress(
        [publicKey!.toBytes()],
        programLootbox!.programId
      )

      const [lootbox] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("LOOTBOX")],
        programLootbox!.programId
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
        // anchor.web3.SystemProgram.transfer({
        //   fromPubkey: publicKey!,
        //   toPubkey: escrow,
        //   lamports: 0.02 * LAMPORTS_PER_SOL,
        // }),
        // // // sync wrapped SOL balance
        // spl.createSyncNativeInstruction(escrow),
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

      const latestBlockHash = await connection.getLatestBlockhash()
      await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: transactionSignature,
      })

      checkUserAccount()
      setIsLoading(false)
    }
  }

  const requestRandomness = async () => {
    if (programSwitchboard && publicKey) {
      const [userState, userStateBump] = await PublicKey.findProgramAddress(
        [publicKey!.toBytes()],
        programLootbox!.programId
      )
      const state = await programLootbox!.account.userState.fetch(userState)

      const queueAccount = new OracleQueueAccount({
        program: programSwitchboard,
        publicKey: new PublicKey(
          "F8ce7MsckeZAbAGmxjJNetxYXQa9mKr9nnrC3qKubyYy"
        ),
      })
      const queueState = await queueAccount.loadData()
      const switchTokenMint = await queueAccount.loadMint()

      const [permissionAccount, permissionBump] = PermissionAccount.fromSeed(
        programSwitchboard,
        queueState.authority,
        queueAccount.publicKey,
        new PublicKey(state.vrf)
      )

      const [programStateAccount, switchboardStateBump] =
        ProgramStateAccount.fromSeed(programSwitchboard)

      const stakeTokenAccount = await spl.getAssociatedTokenAddress(
        STAKE_MINT,
        publicKey!
      )

      const escrow = await spl.getAssociatedTokenAddress(
        switchTokenMint.address,
        new PublicKey(state.vrf),
        true
      )

      const wrappedTokenAccount = await spl.getAssociatedTokenAddress(
        switchTokenMint.address,
        publicKey!
      )

      const txnIxns: TransactionInstruction[] = [
        anchor.web3.SystemProgram.transfer({
          fromPubkey: publicKey!,
          toPubkey: wrappedTokenAccount,
          lamports: 0.002 * LAMPORTS_PER_SOL,
        }),
        // // sync wrapped SOL balance
        spl.createSyncNativeInstruction(wrappedTokenAccount),
        await programLootbox!.methods
          .requestRandomness()
          .accounts({
            state: userState,
            vrf: new PublicKey(state.vrf),
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

      const tx = new Transaction()
      const account = await connection.getAccountInfo(wrappedTokenAccount)
      if (!account) {
        tx.add(
          spl.createAssociatedTokenAccountInstruction(
            publicKey!,
            wrappedTokenAccount,
            publicKey!,
            switchTokenMint.address
          )
        )
      }

      tx.add(...txnIxns)

      const transactionSignature = await sendTransaction(tx, connection)
      console.log(
        `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
      )

      const id = await connection.onAccountChange(userState, (accountInfo) => {
        const account =
          programLootbox!.account.userState.coder.accounts.decodeUnchecked(
            "userState",
            accountInfo.data
          )
        if (account.result.gt(new anchor.BN(0))) {
          checkUserAccount()
          setIsLoading(false)
          connection.removeAccountChangeListener(id)
          console.log(new anchor.BN(account.result).toNumber())
        }
      })
    }
  }

  const mintRewards = async () => {
    if (programSwitchboard && programLootbox) {
      const [userState] = await PublicKey.findProgramAddress(
        [publicKey!.toBytes()],
        programLootbox.programId
      )
      const state = await programLootbox.account.userState.fetch(userState)
      const [mintAuth] = await PublicKey.findProgramAddress(
        [Buffer.from("MINT_AUTH")],
        programLootbox.programId
      )

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

      const latestBlockHash = await connection.getLatestBlockhash()
      await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: transactionSignature,
      })

      checkUserAccount()
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkUserAccount()
  }, [publicKey])

  const init: MouseEventHandler<HTMLButtonElement> = useCallback(
    async (event) => {
      if (event.defaultPrevented) return
      setIsLoading(true)
      initUser()
    },
    [workspace]
  )

  const request: MouseEventHandler<HTMLButtonElement> = useCallback(
    async (event) => {
      if (event.defaultPrevented) return
      setIsLoading(true)
      requestRandomness()
    },
    [workspace]
  )

  const redeem: MouseEventHandler<HTMLButtonElement> = useCallback(
    async (event) => {
      if (event.defaultPrevented) return
      setIsLoading(true)
      mintRewards()
    },
    [workspace]
  )

  return (
    <VStack
      bgColor="containerBg"
      borderRadius="20px"
      padding="20px 40px"
      spacing={5}
    >
      {user ? (
        <VStack>
          {redeemable ? (
            <Button
              bgColor="green"
              color="white"
              maxW="380px"
              onClick={redeem}
              isLoading={isLoading}
            >
              <Text>Redeem</Text>
            </Button>
          ) : (
            <Button
              bgColor="blue"
              color="white"
              maxW="380px"
              onClick={request}
              isLoading={isLoading}
            >
              <Text>Request</Text>
            </Button>
          )}
        </VStack>
      ) : (
        <Button
          bgColor="accent"
          color="white"
          maxW="380px"
          onClick={init}
          isLoading={isLoading}
        >
          <Text>Init</Text>
        </Button>
      )}
    </VStack>
  )
}

export default Lootbox
