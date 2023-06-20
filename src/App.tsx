/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, {useEffect, useState} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  Ed25519Keypair,
  SIGNATURE_SCHEME_TO_FLAG,
  TransactionBlock,
} from '@mysten/sui.js';
import keyring from './core/keyring';
import {getApiEnv, saveApiEnv} from './core/local_storage/LocalStorage';
import ApiProvider, {API_ENV, ENV_DEFAULT} from './core/signer';
import sha from 'js-sha3';

export function toSuiAddressOld(mnemonic: string): string {
  let tmp = new Uint8Array(33);
  let publicKey = Ed25519Keypair.deriveKeypair(mnemonic).getPublicKey();
  tmp.set([SIGNATURE_SCHEME_TO_FLAG['ED25519']]);
  tmp.set(publicKey.toBytes(), 1);
  return '0x' + sha.sha3_256(tmp).slice(0, 40);
}

export const shortHex = (hex: string, length = 6) => {
  if (hex) {
    return hex.slice(0, length) + '...' + hex.slice(-4);
  }
  return '';
};

function App(): JSX.Element {
  const [wallet, setWallet] = useState(
    '0x865a4061eb4d36b8d6e4298c06c4b210df0acf71474462c3a51f67875a14ba91',
  );
  const [objId, setObjId] = useState('');
  const [recip, setRecip] = useState(
    '0x3210185f287cf4ea064fbd89e71301e165911545c75bfa066e55ec1b75acdc98',
  );
  const [packageObjectId, setPackageObjectId] = useState(
    '0x5fff4e6c61f73f7262cef027eea5e10999c6b30eaeefe8a4bc53275bccc946c3',
  );
  const [NFTMintDataObject, setNFTMintDataObject] = useState(
    '0x735a62e8d1702fa1954463d91c0d21daab00ffb848a464e37723107a854cc8f2',
  );
  const [currentNetwork, setCurrentNetwork] = useState<String | null>(
    'mainNet',
  );
  const [index, setIndex] = useState(0);
  const [sendMessage, setSendMessage] = useState('');
  const [mintMessage, setMintMessage] = useState('');

  const sendNFT = async () => {
    try {
      const tx = new TransactionBlock();
      tx.transferObjects([tx.object(objId)], tx.pure(recip));

      const apiProvider = new ApiProvider();
      const account = await keyring.getActiveAccount(index);
      console.log('send acc', account);

      const signer = await apiProvider.getSignerInstance(account);

      console.log('send signer', signer);

      const data = await signer.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        options: {
          showEffects: true,
        },
      });

      if (data) {
        const api = (await apiProvider.instance()).fullNode;

        const result = await api.getTransactionBlock({
          digest: data.digest,
          options: {
            showEffects: true,
            showBalanceChanges: true,
            showObjectChanges: true,
          },
        });

        if (result) {
          setSendMessage('Send NFT Success');
        }
      }
    } catch (e) {
      setSendMessage('Send NFT Failed, ' + e);
    }
  };

  const mintNFT = async () => {
    try {
      const module = 'sensui_nft';
      const mintFunction = 'mint_to_sender';
      const name = 'Example NFT';
      const description = 'Example NFT';
      const url =
        'https://media4.giphy.com/media/l0K4kWJir91VEoa1W/giphy.gif?cid=ecf05e476bb74a4d9ec6d2ee907643ae35f872ab572dc6b2&ep=v1_gifs_gifId&rid=giphy.gif&ct=g';
      const clock = '0x6';

      const tx = new TransactionBlock();

      const apiProvider = new ApiProvider();
      const account = await keyring.getActiveAccount(index);

      console.log('acc', account);

      const signer = await apiProvider.getSignerInstance(account);

      console.log('signer', signer);

      tx.moveCall({
        target: `${packageObjectId}::${module}::${mintFunction}`,
        arguments: [
          tx.pure(NFTMintDataObject),
          tx.pure(name),
          tx.pure(description),
          tx.pure(url),
          tx.pure(clock),
        ],
      });

      console.log('tx', tx);

      await signer
        .signAndExecuteTransactionBlock({
          transactionBlock: tx,
          options: {
            showEffects: true,
          },
        })
        .then(res => {
          console.log('res', res);
          setMintMessage('Mint NFT successfully');
        });
    } catch (e) {
      console.log(e);
      setMintMessage('Mint NFT failed, ' + e);
    }
  };

  useEffect(() => {
    saveApiEnv(ENV_DEFAULT);
  }, []);

  console.log();

  return (
    <SafeAreaView style={styles.sectionContainer}>
      <ScrollView>
        {/* Set Network */}
        <View>
          {/* <TouchableOpacity
            style={{
              marginVertical: 20,
              flexDirection: 'row',
              justifyContent: 'center',
              marginHorizontal: 20,
            }}
            onPress={async () => {
              keyring
                .deriveNextAccount()
                .then(res => console.log('res', res))
                .catch(e => console.log(e));
            }}>
            <Text
              style={[
                styles.text,
                {
                  backgroundColor: '#e6e6e6',
                  textAlign: 'center',
                  paddingVertical: 6,
                  paddingHorizontal: 20,
                },
              ]}>
              Create
            </Text>
          </TouchableOpacity> */}
          <Text style={{color: 'black'}}>Set Network</Text>
          <View style={{flexDirection: 'row', marginVertical: 20}}>
            <TouchableOpacity
              onPress={() => {
                setCurrentNetwork('mainNet');
                saveApiEnv(API_ENV.mainNet);
              }}
              style={{
                marginRight: 12,
                backgroundColor: '#e6e6e6',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderColor: currentNetwork === 'mainNet' ? 'blue' : 'white',
                borderWidth: 1,
              }}>
              <Text>Mainnet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setCurrentNetwork('testNet');
                saveApiEnv(API_ENV.testNet);
              }}
              style={{
                marginRight: 12,
                backgroundColor: '#e6e6e6',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderColor: currentNetwork === 'testNet' ? 'blue' : 'white',
                borderWidth: 1,
              }}>
              <Text>Testnet</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Set Wallet, NFT Object ID, Receive Wallet, Package Object ID, NFT Mint Object*/}
        <View>
          <Text style={{color: 'black'}}>Set Active Wallet</Text>
          <View style={{flexDirection: 'row', marginVertical: 20}}>
            <TouchableOpacity
              onPress={() => {
                keyring.changeActiveAccount(
                  '0x865a4061eb4d36b8d6e4298c06c4b210df0acf71474462c3a51f67875a14ba91',
                );
                setWallet(
                  '0x865a4061eb4d36b8d6e4298c06c4b210df0acf71474462c3a51f67875a14ba91',
                );
                setIndex(0);
                setRecip(
                  '0x3210185f287cf4ea064fbd89e71301e165911545c75bfa066e55ec1b75acdc98',
                );
              }}
              style={{
                marginRight: 12,
                backgroundColor: '#e6e6e6',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderColor: wallet.includes('ba91') ? 'blue' : 'white',
                borderWidth: 1,
              }}>
              <Text>
                {shortHex(
                  '0x865a4061eb4d36b8d6e4298c06c4b210df0acf71474462c3a51f67875a14ba91',
                )}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                keyring.changeActiveAccount(
                  '0x3210185f287cf4ea064fbd89e71301e165911545c75bfa066e55ec1b75acdc98',
                );
                setWallet(
                  '0x3210185f287cf4ea064fbd89e71301e165911545c75bfa066e55ec1b75acdc98',
                );
                setIndex(1);
                setRecip(
                  '0x865a4061eb4d36b8d6e4298c06c4b210df0acf71474462c3a51f67875a14ba91',
                );
              }}
              style={{
                marginRight: 12,
                backgroundColor: '#e6e6e6',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderColor: wallet.includes('dc98') ? 'blue' : 'white',
                borderWidth: 1,
              }}>
              <Text>
                {shortHex(
                  '0x3210185f287cf4ea064fbd89e71301e165911545c75bfa066e55ec1b75acdc98',
                )}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View>
          <Text style={{color: 'black'}}>Recieve Address</Text>
          <View style={{flexDirection: 'row', marginVertical: 20}}>
            <TouchableOpacity
              onPress={() => {
                setRecip(
                  '0x865a4061eb4d36b8d6e4298c06c4b210df0acf71474462c3a51f67875a14ba91',
                );
                keyring.changeActiveAccount(
                  '0x3210185f287cf4ea064fbd89e71301e165911545c75bfa066e55ec1b75acdc98',
                );
                setWallet(
                  '0x3210185f287cf4ea064fbd89e71301e165911545c75bfa066e55ec1b75acdc98',
                );
                setIndex(1);
              }}
              style={{
                marginRight: 12,
                backgroundColor: '#e6e6e6',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderColor: recip.includes('ba91') ? 'blue' : 'white',
                borderWidth: 1,
              }}>
              <Text>
                {shortHex(
                  '0x865a4061eb4d36b8d6e4298c06c4b210df0acf71474462c3a51f67875a14ba91',
                )}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setRecip(
                  '0x3210185f287cf4ea064fbd89e71301e165911545c75bfa066e55ec1b75acdc98',
                );
                keyring.changeActiveAccount(
                  '0x865a4061eb4d36b8d6e4298c06c4b210df0acf71474462c3a51f67875a14ba91',
                );
                setWallet(
                  '0x865a4061eb4d36b8d6e4298c06c4b210df0acf71474462c3a51f67875a14ba91',
                );
                setIndex(0);
              }}
              style={{
                marginRight: 12,
                backgroundColor: '#e6e6e6',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderColor: recip.includes('dc98') ? 'blue' : 'white',
                borderWidth: 1,
              }}>
              <Text>
                {shortHex(
                  '0x3210185f287cf4ea064fbd89e71301e165911545c75bfa066e55ec1b75acdc98',
                )}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View>
          <Text style={{color: 'black'}}>Object Id</Text>
          <TextInput
            style={{height: 60}}
            onChangeText={setObjId}
            value={objId}
            multiline={true}
            numberOfLines={4}
            placeholder={'Enter Object ID'}
            placeholderTextColor="#a3a3a3"></TextInput>
        </View>
        <View>
          <Text style={{color: 'black'}}>Package Object ID</Text>
          <TextInput
            style={{height: 60}}
            onChangeText={setPackageObjectId}
            value={packageObjectId}
            multiline={true}
            numberOfLines={4}
            placeholder={'Enter Package Object ID'}
            placeholderTextColor="#a3a3a3"></TextInput>
        </View>
        <View>
          <Text style={{color: 'black'}}>NFT Mint Object</Text>
          <TextInput
            style={{height: 60}}
            onChangeText={setNFTMintDataObject}
            value={NFTMintDataObject}
            multiline={true}
            numberOfLines={4}
            placeholder={'Enter NFT Mint Object'}
            placeholderTextColor="#a3a3a3"></TextInput>
        </View>

        {/* Button Send & Mint */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignContent: 'center',
            marginTop: 20,
          }}>
          <TouchableOpacity
            style={{
              marginVertical: 20,
              flexDirection: 'row',
              justifyContent: 'center',
              marginHorizontal: 20,
            }}
            onPress={() => {
              sendNFT();
            }}>
            <Text
              style={[
                styles.text,
                {
                  backgroundColor: '#e6e6e6',
                  textAlign: 'center',
                  paddingVertical: 6,
                  paddingHorizontal: 20,
                },
              ]}>
              Send NFT
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              marginVertical: 20,
              flexDirection: 'row',
              justifyContent: 'center',
              marginHorizontal: 20,
            }}
            onPress={() => {
              mintNFT();
            }}>
            <Text
              style={[
                styles.text,
                {
                  backgroundColor: '#e6e6e6',
                  textAlign: 'center',
                  paddingVertical: 6,
                  paddingHorizontal: 20,
                },
              ]}>
              Mint NFT
            </Text>
          </TouchableOpacity>
        </View>
        <View>
          <Text style={{color: 'green'}}>{sendMessage}</Text>
          <Text style={{color: 'red'}}>{mintMessage}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
  text: {
    fontSize: 20,
  },
});

export default App;
