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
import * as sbv2 from "@switchboard-xyz/switchboard-v2"
import * as anchor from "@project-serum/anchor"

const Lootbox: FC = () => {
  const { connection } = useConnection()
  const walletAdapter = useWallet()
  const workspace = useWorkspace()
  const programLootbox = workspace.programStaking
  const programSwitchboard = workspace.programSwitchboard
  const provider = workspace.provider

  const router = useRouter()

  const switchboard = async () => {
    // const IDL = await anchor.Program.fetchIdl(SBV2_DEVNET_PID, provider)
    // console.log(IDL)
    console.log("test", programSwitchboard)
    console.log(programLootbox)
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
