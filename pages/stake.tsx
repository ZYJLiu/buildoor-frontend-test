import { ReactNode, useEffect, useState, useMemo, useCallback } from "react"
import type { NextPage } from "next"
import MainLayout from "../components/MainLayout"
import {
  Heading,
  VStack,
  Text,
  Image,
  Center,
  Button,
  HStack,
  Flex,
  Spinner,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
} from "@chakra-ui/react"
import { PublicKey, Transaction } from "@solana/web3.js"
import { getAssociatedTokenAddress } from "@solana/spl-token"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { Metaplex, walletAdapterIdentity } from "@metaplex-foundation/js"
import { STAKE_MINT } from "../utils/constants"
import { PROGRAM_ID as METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata"
import { useWorkspace } from "../context/Anchor"
import Lootbox from "../components/Lootbox"

const ItemBox = ({
  children,
  bgColor,
}: {
  children: ReactNode
  bgColor?: string
}) => {
  return (
    <Center
      height="120px"
      width="120px"
      bgColor={bgColor || "containerBg"}
      borderRadius="10px"
    >
      {children}
    </Center>
  )
}

const Stake: NextPage<StakeProps> = ({ mint, imageSrc, level }) => {
  const [nftData, setNftData] = useState<any>()
  const [stakeAccountAddress, setStakeAccountAddress] = useState<PublicKey>()
  const [tokenAccountAddress, setTokenAccountAddress] = useState<PublicKey>()
  const [stakeState, setStakeState] = useState<any>()
  const [isStaking, setIsStaking] = useState(false)
  const [stakeRewards, setStakeRewards] = useState(0)
  const [stakeTime, setStakeTime] = useState(String)
  const { isOpen, onOpen, onClose } = useDisclosure()

  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const walletAdapter = useWallet()

  const workspace = useWorkspace()
  const programStaking = workspace.programStaking

  // metaplex setup
  const metaplex = useMemo(() => {
    return Metaplex.make(connection).use(walletAdapterIdentity(walletAdapter))
  }, [connection, walletAdapter])

  // send stake transaction
  const handleStake = async () => {
    if (programStaking && nftData) {
      const transaction = await programStaking.methods
        .stake()
        .accounts({
          nftTokenAccount: tokenAccountAddress,
          nftMint: nftData.mint.address,
          nftEdition: nftData.edition.address,
          metadataProgram: METADATA_PROGRAM_ID,
        })
        .transaction()

      // helper function to send and confirm transaction
      sendAndConfirmTransaction(transaction)
    }
  }

  // send redeem transaction
  const handleRedeem = async () => {
    if (programStaking && publicKey) {
      // get stake rewards token address
      const stakeRewardTokenAddress = await getAssociatedTokenAddress(
        STAKE_MINT,
        publicKey
      )

      const transaction = await programStaking.methods
        .redeem()
        .accounts({
          nftTokenAccount: tokenAccountAddress,
          stakeMint: STAKE_MINT,
          userStakeAta: stakeRewardTokenAddress,
        })
        .transaction()

      // helper function to send and confirm transaction
      sendAndConfirmTransaction(transaction)
    }
  }

  // send unstake transaction
  const handleUnstake = async () => {
    if (publicKey && programStaking) {
      const stakeRewardTokenAddress = await getAssociatedTokenAddress(
        STAKE_MINT,
        publicKey
      )
      const transaction = await programStaking.methods
        .unstake()
        .accounts({
          nftTokenAccount: tokenAccountAddress,
          nftMint: nftData.mint.address,
          nftEdition: nftData.edition.address,
          stakeMint: STAKE_MINT,
          userStakeAta: stakeRewardTokenAddress,
          metadataProgram: METADATA_PROGRAM_ID,
        })
        .transaction()
      // helper function to send and confirm transaction
      sendAndConfirmTransaction(transaction)
    }
  }

  // helper function to send and confirm transaction
  const sendAndConfirmTransaction = async (transaction: Transaction) => {
    try {
      // send transaction
      const transactionSignature = await sendTransaction(
        transaction,
        connection
      )

      // open loading modal
      onOpen()

      // wait for transaction confirmation
      // using "finalized" otherwise switching between staking / unstaking sometimes doesn't work and redeem amount not updated correctly
      const latestBlockHash = await connection.getLatestBlockhash()
      await connection.confirmTransaction(
        {
          blockhash: latestBlockHash.blockhash,
          lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
          signature: transactionSignature,
        },
        "finalized"
      )

      // close loading modal once transaction confirmation finalized
      onClose()

      console.log(
        `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
      )

      // check status of stateState
      checkStakeStatus()
    } catch (error) {}
  }

  // fetch NFT data
  const fetchNft = async () => {
    metaplex
      .nfts()
      .findByMint({ mintAddress: new PublicKey(mint) })
      .run()
      .then((nft) => {
        setNftData(nft)
      })

    const tokenAccount = (
      await connection.getTokenLargestAccounts(new PublicKey(mint))
    ).value[0].address

    setTokenAccountAddress(tokenAccount)

    if (programStaking && publicKey) {
      // derive stakeState account PDA
      const [stakeStatePDA] = await PublicKey.findProgramAddress(
        [publicKey.toBuffer(), tokenAccount.toBuffer()],
        programStaking.programId
      )

      setStakeAccountAddress(stakeStatePDA)
    }
  }

  // check stake status of NFT
  const checkStakeStatus = async () => {
    if (programStaking && stakeAccountAddress) {
      try {
        // fetch stakeState account data
        const stakeStateAccount =
          await programStaking.account.userStakeInfo.fetch(stakeAccountAddress)
        console.log(Object.keys(stakeStateAccount.stakeState))
        setStakeState(stakeStateAccount)

        // set staking status
        if (
          (Object.keys(stakeStateAccount.stakeState) as unknown as string) ==
          "staked"
        ) {
          setIsStaking(true)
        } else {
          setIsStaking(false)
        }
      } catch (error: unknown) {}
    }
  }

  // calculate stake rewards
  const checkStakeRewards = async () => {
    if (stakeState) {
      // get current solana clock time
      const slot = await connection.getSlot({ commitment: "confirmed" })
      const timestamp = await connection.getBlockTime(slot)
      const rewards = timestamp! - stakeState.lastStakeRedeem.toNumber()
      const duration = timestamp! - stakeState.stakeStartTime.toNumber()
      convert(duration)
      setStakeRewards(rewards)
    }
  }

  // convert total time staked to string for display
  const convert = async (time: number) => {
    setStakeTime(
      Math.floor(time / 24 / 60) +
        " HR : " +
        Math.floor((time / 60) % 24) +
        " MIN : " +
        Math.floor(time % 60) +
        " SEC "
    )
  }

  // fetch NFT data
  useEffect(() => {
    fetchNft()
  }, [mint, programStaking])

  // check stake status
  useEffect(() => {
    checkStakeStatus()
  }, [tokenAccountAddress])

  // check stake rewards
  useEffect(() => {
    if (isStaking) {
      const interval = setInterval(() => {
        checkStakeRewards()
      }, 1000)
      return () => clearInterval(interval)
    } else {
      setStakeRewards(0)
    }
  }, [isStaking, stakeState])

  return (
    <MainLayout centered={false} topAlign={true}>
      <VStack
        spacing={7}
        justify="flex-start"
        align="flex-start"
        paddingLeft="40px"
      >
        <Heading color="white" as="h1" size="2xl">
          Level up your buildoor
        </Heading>
        <Text color="bodyText" fontSize="xl" textAlign="start" maxWidth="600px">
          Stake your buildoor to earn $BLD and get access to a randomized loot
          box full of upgrades for your buildoor
        </Text>
        <HStack spacing={20} alignItems="flex-start">
          <VStack align="flex-start" minWidth="200px">
            <Flex direction="column">
              <Image src={imageSrc ?? ""} alt="buildoor nft" zIndex="1" />
              <Center
                bgColor="secondaryPurple"
                borderRadius="0 0 8px 8px"
                marginTop="-8px"
                zIndex="2"
                height="32px"
              >
                <Text
                  color="white"
                  as="b"
                  fontSize="md"
                  width="100%"
                  textAlign="center"
                >
                  {isStaking ? "STAKING" : "UNSTAKED"}
                </Text>
              </Center>
            </Flex>
            <Text fontSize="2xl" as="b" color="white">
              LEVEL {level}
            </Text>
          </VStack>
          <VStack alignItems="flex-start" spacing={10}>
            <HStack spacing={10}>
              <VStack
                bgColor="containerBg"
                borderRadius="20px"
                padding="20px 40px"
                spacing={5}
              >
                <Text
                  bgColor="containerBgSecondary"
                  padding="4px 8px"
                  borderRadius="20px"
                  color="bodyText"
                  as="b"
                  fontSize="sm"
                >
                  {isStaking ? `${stakeTime}` : "READY TO STAKE"}
                </Text>
                <VStack spacing={-1}>
                  <Text color="white" as="b" fontSize="4xl">
                    {isStaking ? `${stakeRewards} $BLD` : "0 $BLD"}
                  </Text>
                </VStack>
                {isStaking ? (
                  <Button
                    onClick={handleRedeem}
                    bgColor="buttonGreen"
                    width="200px"
                  >
                    <Text as="b">Redeem $BLD</Text>
                  </Button>
                ) : (
                  <Text color="bodyText" as="b">
                    Earn $BLD by Staking
                  </Text>
                )}
                <Button
                  onClick={isStaking ? handleUnstake : handleStake}
                  bgColor="buttonGreen"
                  width="200px"
                >
                  <Text as="b">
                    {isStaking ? "Unstake buildoor" : "Stake buildoor"}
                  </Text>
                </Button>
              </VStack>
              <Lootbox />
            </HStack>

            <HStack spacing={10}>
              <VStack alignItems="flex-start">
                <Text color="white" as="b" fontSize="2xl">
                  Gear
                </Text>
                <HStack>
                  <ItemBox>mock</ItemBox>
                  <ItemBox>mock</ItemBox>
                </HStack>
              </VStack>
              <VStack alignItems="flex-start">
                <Text color="white" as="b" fontSize="2xl">
                  Loot Boxes
                </Text>
                <HStack>
                  <ItemBox>mock</ItemBox>
                  <ItemBox>mock</ItemBox>
                  <ItemBox>mock</ItemBox>
                </HStack>
              </VStack>
            </HStack>
          </VStack>
        </HStack>
      </VStack>
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent width="275px" height="150px">
          <ModalHeader>Waiting Confirmation</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Center>
              <Spinner
                thickness="10px"
                speed="1.5s"
                emptyColor="gray.200"
                color="blue.500"
                size="xl"
              />
            </Center>
          </ModalBody>
        </ModalContent>
      </Modal>
    </MainLayout>
  )
}

interface StakeProps {
  mint: PublicKey
  imageSrc: string
  level: number
}

Stake.getInitialProps = async ({ query }: any) => {
  const { mint, imageSrc } = query

  if (!mint) throw { error: "no mint" }

  try {
    const mintPubkey = new PublicKey(mint)
    return {
      mint: mintPubkey,
      level: 1,
      imageSrc,
    }
  } catch {
    throw { error: "invalid mint" }
  }
}

export default Stake
