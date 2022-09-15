import type { NextPage } from "next"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import MainLayout from "../components/MainLayout"
import { Container, Heading, VStack, Text, HStack } from "@chakra-ui/react"
import { MouseEventHandler, useCallback, useEffect, useState } from "react"
import { PublicKey } from "@solana/web3.js"
import { Metaplex, walletAdapterIdentity } from "@metaplex-foundation/js"
import StakeStatus from "../components/StakeStatus"

const Display: NextPage = () => {
  const collectionAddress = new PublicKey(
    "3oWxQJFB2cW83xXLgMViWos3RxjD3euxJ1Y5nXpyJVWh"
  )

  const { connection } = useConnection()
  const wallet = useWallet()
  const metaplex = Metaplex.make(connection).use(walletAdapterIdentity(wallet))

  const [nfts, setNfts] = useState<any[]>()

  // fetch nfts for connected wallet
  const fetchNfts = async () => {
    if (!wallet.connected) {
      return
    }

    const nfts = await metaplex
      .nfts()
      .findAllByOwner({ owner: wallet.publicKey! })
      .run()

    // filter for nfts in collection
    let nft = []
    for (let i = 0; i < nfts.length; i++) {
      if (
        nfts[i].collection?.address.toString() == collectionAddress.toString()
      ) {
        nft.push(nfts[i])
      }
    }

    setNfts(nft)
  }

  // fetch nfts when wallet changes
  useEffect(() => {
    fetchNfts()
  }, [wallet])

  return (
    <MainLayout>
      <VStack spacing={20}>
        <Container>
          <VStack spacing={8}>
            <Heading
              color="white"
              as="h1"
              size="2xl"
              noOfLines={1}
              textAlign="center"
            >
              My Buildoors.
            </Heading>

            <Text color="bodyText" fontSize="xl" textAlign="center">
              Stake Buildoor to earn $BLD
            </Text>
          </VStack>
        </Container>

        <HStack alignItems="top" spacing={10}>
          {nfts?.map((nft) => (
            <StakeStatus nft={nft} />
          ))}
        </HStack>
      </VStack>
    </MainLayout>
  )
}

export default Display
