import { Button, VStack, Text, Image } from "@chakra-ui/react"
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
  const { publicKey, sendTransaction } = useWallet()

  const workspace = useWorkspace()
  const programLootbox = workspace.programLootbox
  const programSwitchboard = workspace.programSwitchboard

  const [vrfKeypair] = useState(new anchor.web3.Keypair())
  const [userStatePDA, setUserStatePDA] = useState<PublicKey>()
  const [userAccountExist, setUserAccountExist] = useState(false)
  const [redeemable, setRedeemable] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // derive UserStatePDA and set to state
  const getUserStatePDA = async () => {
    if (programLootbox && publicKey) {
      const [userState] = await PublicKey.findProgramAddress(
        [publicKey.toBytes()],
        programLootbox.programId
      )
      setUserStatePDA(userState)
    }
  }

  // check if UserState account exists
  // if UserState account exists also check if there is a redeemable item from lootbox
  const checkUserAccount = async () => {
    if (programLootbox && userStatePDA) {
      try {
        const account = await programLootbox.account.userState.fetch(
          userStatePDA
        )
        if (account) {
          setUserAccountExist(true)
          setRedeemable(account.redeemable)
        } else {
          setUserAccountExist(false)
        }
      } catch (e) {}
    }
  }

  // derive UserStatePDA when publickey changes (on first load)
  useEffect(() => {
    getUserStatePDA()
  }, [publicKey])

  // check UserState (on first load after getUserStatePDA runs)
  useEffect(() => {
    checkUserAccount()
  }, [userStatePDA])

  // logic to initialize UserState account and required switchboard accounts
  const initUser = async () => {
    if (programSwitchboard && programLootbox && publicKey && userStatePDA) {
      // required switchboard accoount
      const [programStateAccount, stateBump] =
        ProgramStateAccount.fromSeed(programSwitchboard)

      // required switchboard accoount
      const queueAccount = new OracleQueueAccount({
        program: programSwitchboard,
        // devnet permissionless queue
        publicKey: new PublicKey(
          "F8ce7MsckeZAbAGmxjJNetxYXQa9mKr9nnrC3qKubyYy"
        ),
      })

      // required switchboard accoount
      const queueState = await queueAccount.loadData()
      // wrapped SOL is used to pay for switchboard VRF requests
      const wrappedSOLMint = await queueAccount.loadMint()
      // size of switchboard VRF Account to initialize
      const size = programSwitchboard.account.vrfAccountData.size

      // required switchboard accoount
      const [permissionAccount, permissionBump] = PermissionAccount.fromSeed(
        programSwitchboard,
        queueState.authority,
        queueAccount.publicKey,
        vrfKeypair.publicKey
      )

      // required switchboard accoount
      // escrow wrapped SOL token account owned by the VRF account we will initialize
      const escrow = await spl.getAssociatedTokenAddress(
        wrappedSOLMint.address,
        vrfKeypair.publicKey,
        true
      )

      // lootbox account PDA
      const [lootbox] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("LOOTBOX")],
        programLootbox.programId
      )

      const txnIxns: TransactionInstruction[] = [
        // create escrow ATA owned by VRF account
        spl.createAssociatedTokenAccountInstruction(
          publicKey,
          escrow,
          vrfKeypair.publicKey,
          wrappedSOLMint.address
        ),
        // transfer escrow ATA owner to switchboard programStateAccount
        spl.createSetAuthorityInstruction(
          escrow,
          vrfKeypair.publicKey,
          spl.AuthorityType.AccountOwner,
          programStateAccount.publicKey,
          [vrfKeypair]
        ),
        // request system program to create new account using newly generated keypair for VRF account
        anchor.web3.SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: vrfKeypair.publicKey,
          space: size,
          lamports:
            await programSwitchboard.provider.connection.getMinimumBalanceForRentExemption(
              size
            ),
          programId: programSwitchboard.programId,
        }),
        // initialize new VRF account, included the callback CPI into lootbox program as instruction data
        await programSwitchboard.methods
          .vrfInit({
            stateBump,
            callback: {
              programId: programLootbox.programId,
              accounts: [
                { pubkey: userStatePDA, isSigner: false, isWritable: true },
                {
                  pubkey: vrfKeypair.publicKey,
                  isSigner: false,
                  isWritable: false,
                },
                { pubkey: lootbox, isSigner: false, isWritable: false },
                { pubkey: publicKey, isSigner: false, isWritable: false },
              ],
              ixData: new anchor.BorshInstructionCoder(
                programLootbox.idl
              ).encode("consumeRandomness", ""),
            },
          })
          .accounts({
            vrf: vrfKeypair.publicKey,
            escrow: escrow,
            authority: userStatePDA,
            oracleQueue: queueAccount.publicKey,
            programState: programStateAccount.publicKey,
            tokenProgram: spl.TOKEN_PROGRAM_ID,
          })
          .instruction(),
        // initialize switchboard permission account, required account
        await programSwitchboard.methods
          .permissionInit({})
          .accounts({
            permission: permissionAccount.publicKey,
            authority: queueState.authority,
            granter: queueAccount.publicKey,
            grantee: vrfKeypair.publicKey,
            payer: publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .instruction(),
        // initialize UserState account for lootbox program
        // commented out accounts are ones that Anchor infers
        await programLootbox.methods
          .initUser({
            switchboardStateBump: stateBump,
            vrfPermissionBump: permissionBump,
          })
          .accounts({
            // state: userStatePDA,
            vrf: vrfKeypair.publicKey,
            // payer: publicKey,
            // systemProgram: anchor.web3.SystemProgram.programId,
          })
          .instruction(),
      ]

      // all all instructions to new transaction
      const tx = new Transaction().add(...txnIxns)

      // send transaction, with new VRF account keypair as additional signer
      const transactionSignature = await sendTransaction(tx, connection, {
        signers: [vrfKeypair],
      })

      console.log(
        `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
      )

      // confirm transaction
      const latestBlockHash = await connection.getLatestBlockhash()
      await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: transactionSignature,
      })

      // check UserState account, updates button to display
      checkUserAccount()
      setIsLoading(false)
    }
  }

  // request randomness instruction CPIs to switchboard
  // the VRF callback instruction then CPIs back to lootbox program
  // uses the random value from VRF to selects an lootbox item "mint" and stores on the UserState (also stores the random number that was generated)
  const requestRandomness = async () => {
    if (programSwitchboard && programLootbox && publicKey && userStatePDA) {
      // fetch UserState
      const state = await programLootbox.account.userState.fetch(userStatePDA)

      // required switchboard accoount
      const [programStateAccount] =
        ProgramStateAccount.fromSeed(programSwitchboard)

      // required switchboard accoount
      const queueAccount = new OracleQueueAccount({
        program: programSwitchboard,
        publicKey: new PublicKey(
          "F8ce7MsckeZAbAGmxjJNetxYXQa9mKr9nnrC3qKubyYy"
        ),
      })

      // required switchboard accoount
      const queueState = await queueAccount.loadData()
      const wrappedSOLMint = await queueAccount.loadMint()

      // required switchboard accoount
      // derive using VRF account stored on UserState account
      const [permissionAccount] = PermissionAccount.fromSeed(
        programSwitchboard,
        queueState.authority,
        queueAccount.publicKey,
        new PublicKey(state.vrf)
      )

      // required switchboard accoount
      // derive using VRF account stored on UserState account
      const escrow = await spl.getAssociatedTokenAddress(
        wrappedSOLMint.address,
        new PublicKey(state.vrf),
        true
      )

      // user Wrapped SOL token account
      // wSOL amount is then transferred to escrow account to pay switchboard oracle for VRF request
      const wrappedTokenAccount = await spl.getAssociatedTokenAddress(
        wrappedSOLMint.address,
        publicKey
      )

      // user BLD token account, used to pay BLD tokens to call the request randomness instruction on Lootbox program
      const stakeTokenAccount = await spl.getAssociatedTokenAddress(
        STAKE_MINT,
        publicKey
      )

      // create new transaction
      const tx = new Transaction()

      // check if a wrapped SOL token account exists, if not add instruction to create one
      const account = await connection.getAccountInfo(wrappedTokenAccount)
      if (!account) {
        tx.add(
          spl.createAssociatedTokenAccountInstruction(
            publicKey,
            wrappedTokenAccount,
            publicKey,
            wrappedSOLMint.address
          )
        )
      }

      // additional instructions
      const txnIxns: TransactionInstruction[] = [
        // transfer SOL to user's own wSOL token account
        anchor.web3.SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: wrappedTokenAccount,
          lamports: 0.002 * LAMPORTS_PER_SOL,
        }),
        // sync wrapped SOL balance
        spl.createSyncNativeInstruction(wrappedTokenAccount),
        // Lootbox program request randomness instruction
        // commented out accounts are ones that Anchor infers
        await programLootbox.methods
          .requestRandomness()
          .accounts({
            // state: userState,
            vrf: new PublicKey(state.vrf),
            oracleQueue: queueAccount.publicKey,
            queueAuthority: queueState.authority,
            dataBuffer: queueState.dataBuffer,
            permission: permissionAccount.publicKey,
            escrow: escrow,
            programState: programStateAccount.publicKey,
            switchboardProgram: programSwitchboard.programId,
            payerWallet: wrappedTokenAccount,
            // payer: publicKey,
            recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
            stakeMint: STAKE_MINT,
            stakeTokenAccount: stakeTokenAccount,
            // tokenProgram: spl.TOKEN_PROGRAM_ID,
          })
          .instruction(),
      ]

      // add additional instructions to transaction
      tx.add(...txnIxns)

      // send transaction
      const transactionSignature = await sendTransaction(tx, connection)
      console.log(
        `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
      )

      // listen for changes to UserState account
      // after calling request randomness instruction, must wait for switchboard oracle to CPI back to lootbox program
      // the oracle will make a CPI using the callback instruction stored on the VRF account (the VRF account pubkey is stored on the UserState account)
      const id = await connection.onAccountChange(
        userStatePDA,
        (accountInfo) => {
          const account =
            programLootbox.account.userState.coder.accounts.decodeUnchecked(
              "userState",
              accountInfo.data
            )
          // if the UserState result field is greater than 0, then callback is complete, a random number was generated, and a lootbox item was selected
          if (account.result.gt(new anchor.BN(0))) {
            // check UserState account, updates button to display
            checkUserAccount()
            setIsLoading(false)
            connection.removeAccountChangeListener(id)
            console.log(new anchor.BN(account.result).toNumber())
          }
        }
      )
    }
  }

  // mint randomly selected lootbox item instruction from lootbox program
  const mintRewards = async () => {
    if (programLootbox && userStatePDA) {
      // fetch UserState
      const state = await programLootbox.account.userState.fetch(userStatePDA)

      // create transaction to mint item stored on UserState account
      // there's is a "redeemable" flag stored on UserState account to determine if item was already redeemed
      // commented out accounts are ones that Anchor infers
      const tx = await programLootbox.methods
        .mintReward()
        .accounts({
          // state: userStatePDA,
          mint: state.mint,
          tokenAccount: state.tokenAccount,
          // mintAuthority: mintAuth,
          // tokenProgram: spl.TOKEN_PROGRAM_ID,
          // associatedTokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
          // rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          // systemProgram: anchor.web3.SystemProgram.programId,
          // payer: publicKey,
        })
        .transaction()

      // send transaction
      const transactionSignature = await sendTransaction(tx, connection)
      console.log(
        `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
      )

      // confirm transaction
      const latestBlockHash = await connection.getLatestBlockhash()
      await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: transactionSignature,
      })

      // check UserAccount
      checkUserAccount()
      setIsLoading(false)
    }
  }

  const init: MouseEventHandler<HTMLButtonElement> = useCallback(
    async (event) => {
      if (event.defaultPrevented) return
      setIsLoading(true)
      initUser()
    },
    [workspace, userStatePDA]
  )

  const request: MouseEventHandler<HTMLButtonElement> = useCallback(
    async (event) => {
      if (event.defaultPrevented) return
      setIsLoading(true)
      requestRandomness()
    },
    [workspace, userStatePDA]
  )

  const redeem: MouseEventHandler<HTMLButtonElement> = useCallback(
    async (event) => {
      if (event.defaultPrevented) return
      setIsLoading(true)
      mintRewards()
    },
    [workspace, userStatePDA]
  )

  return (
    <VStack
      bgColor="containerBg"
      borderRadius="20px"
      padding="20px 40px"
      spacing={5}
    >
      {userAccountExist ? (
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
