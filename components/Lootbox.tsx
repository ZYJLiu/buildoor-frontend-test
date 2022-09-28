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
import { PublicKey } from "@solana/web3.js"
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

const Lootbox: FC = () => {
  const { connection } = useConnection()
  const walletAdapter = useWallet()
  const { publicKey, sendTransaction } = useWallet()
  const workspace = useWorkspace()
  const programLootbox = workspace.programLootbox
  const programSwitchboard = workspace.programSwitchboard
  const provider = workspace.provider

  const router = useRouter()

  const setup = async () => {
    if (programSwitchboard) {
      const payerKeypair = provider?.wallet

      const [programStateAccount, stateBump] =
        ProgramStateAccount.fromSeed(programSwitchboard)
      // keypair for vrf account
      const vrfKeypair = anchor.web3.Keypair.generate()

      const queueAccount = new OracleQueueAccount({
        program: programSwitchboard,
        // devnet permissionless queue
        publicKey: new PublicKey(
          "F8ce7MsckeZAbAGmxjJNetxYXQa9mKr9nnrC3qKubyYy"
        ),
      })
      const queueData = await queueAccount.loadData()

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
        programSwitchboard.programId
      )
      const [lootbox] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("LOOTBOX")],
        programSwitchboard.programId
      )

      const tx = await programSwitchboard.methods
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
        .preInstructions([
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
        ])
        .signers([vrfKeypair])
        .transaction()

      console.log(tx)

      const sig = await sendTransaction(tx, connection, {
        signers: [vrfKeypair],
      })

      console.log(sig)

      // keypair for vrf account
      // const vrfKeypair = anchor.web3.Keypair.generate()

      // // find PDA used for our client state pubkey
      // const [userState, userStateBump] = await PublicKey.findProgramAddress(
      //   [publicKey!.toBytes(), vrfKeypair.publicKey.toBytes()],
      //   programSwitchboard.programId
      // )
      // const vrfAccount = new VrfAccount({
      //   program: programSwitchboard,
      //   publicKey: publicKey!,
      // })

      // const queueAccount = new OracleQueueAccount({
      //   program: programSwitchboard,
      //   // devnet permissionless queue
      //   publicKey: new PublicKey(
      //     "F8ce7MsckeZAbAGmxjJNetxYXQa9mKr9nnrC3qKubyYy"
      //   ),
      // })

      // const vrfAccount = await VrfAccount.create(programSwitchboard, {
      //   keypair: vrfKeypair,
      //   authority: userState, // set vrfAccount authority as PDA
      //   queue: programSwitchboard.queue,
      //   callback: {
      //     programId: programLootbox!.programId,
      //     accounts: [
      //       { pubkey: userState, isSigner: false, isWritable: true },
      //       {
      //         pubkey: vrfKeypair.publicKey,
      //         isSigner: false,
      //         isWritable: false,
      //       },
      //       { pubkey: lootbox, isSigner: false, isWritable: false },
      //       { pubkey: publicKey!, isSigner: false, isWritable: false },
      //     ],
      //     ixData: new anchor.BorshInstructionCoder(programLootbox!.idl).encode(
      //       "consumeRandomness",
      //       ""
      //     ),
      //   },
      // })
    }
  }

  const switchboard = async () => {
    // const IDL = await anchor.Program.fetchIdl(SBV2_DEVNET_PID, provider)
    // console.log(IDL)
    console.log("switchboard", programSwitchboard)
    console.log("lootbox", programLootbox)
    setup()
  }

  useEffect(() => {
    switchboard()
  }, [])

  const handleClick: MouseEventHandler<HTMLButtonElement> = useCallback(
    async (event) => {
      if (event.defaultPrevented) return
      switchboard()
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
      <Button bgColor="accent" color="white" maxW="380px" onClick={handleClick}>
        <Text>mint buildoor</Text>
      </Button>
    </VStack>
  )
}

export default Lootbox
