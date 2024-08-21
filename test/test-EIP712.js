const ethUtil = require('ethereumjs-util');
const abi = require('ethereumjs-abi');
const chai = require('chai');
const {expect} = chai;
const { BigNumber, utils } = require("ethers");
const { ethers } = require('hardhat');
const { provider } = ethers;

const {
  hexStripZeros,
  solidityPack,
  concat,
  toUtf8Bytes,
  keccak256,
  SigningKey,
  formatBytes32String,
  joinSignature,
} = utils;

require('dotenv').config();

  // TypeHash
  const EIP712_DOMAIN = keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'));
  const SET_PROJECT_VOTE = keccak256(toUtf8Bytes('applyProjectVote(uint256 serialNo,address projectAddr,uint256 supportCount,uint256 opposeCount,uint256 voteRatio,uint256 expireTime,uint256 nonce,uint256 deadline)'));
  const SET_APNFT_METADATA_URI = keccak256(toUtf8Bytes('setApNFTMetadataURI(uint256 serialNo,string metadataURI,uint256 nonce,uint256 deadline)'));

  const POLYGON_CHAIN_ID = 137;
  const CORESKE_HUB = 'CoreskyHub Protocol';
  const EIP712_DOMAIN_VERSION = '2';
  const EIP712_DOMAIN_VERSION_HASH = keccak256(toUtf8Bytes(EIP712_DOMAIN_VERSION));
  const EIP1271_MAGIC_VALUE = 0x1626ba7e;

  console.log("EIP712_DOMAIN_VERSION_HASH1",EIP712_DOMAIN_VERSION_HASH)
  console.log("EIP712_DOMAIN_VERSION_HASH2",ethUtil.bufferToHex(ethUtil.keccakFromString(EIP712_DOMAIN_VERSION)));

const typedData = {
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    applyProjectVote: [
      { name: 'serialNo', type: 'uint256' },
      { name: 'projectAddr', type: 'address' },
      { name: 'supportCount', type: 'uint256' },
      { name: 'opposeCount', type: 'uint256' },
      { name: 'voteRatio', type: 'uint256' },
      { name: 'expireTime', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ]
  },
  primaryType: 'applyProjectVote',
  domain: {
    name: CORESKE_HUB,
    version: EIP712_DOMAIN_VERSION,
    chainId: POLYGON_CHAIN_ID,
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
  },
  message: {
    serialNo: '123456',
    projectAddr: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
    supportCount: '10',
    opposeCount: '5',
    voteRatio: '123456',
    expireTime: '123456',
    uint256: '1',
    deadline: '123456',
  },
};

const types = typedData.types;

// Recursively finds all the dependencies of a type
function dependencies(primaryType, found = []) {
  if (found.includes(primaryType)) {
    return found;
  }
  if (types[primaryType] === undefined) {
    return found;
  }
  found.push(primaryType);
  for (let field of types[primaryType]) {
    for (let dep of dependencies(field.type, found)) {
      if (!found.includes(dep)) {
        found.push(dep);
      }
    }
  }
  return found;
}

function encodeType(primaryType) {
  // Get dependencies primary first, then alphabetical
  let deps = dependencies(primaryType);
  deps = deps.filter((t) => t != primaryType);
  deps = [primaryType].concat(deps.sort());

  // Format as a string with fields
  let result = '';
  for (let type of deps) {
    result += `${type}(${types[type]
      .map(({ name, type }) => `${type} ${name}`)
      .join(',')})`;
  }
  return result;
}

function typeHash(primaryType) {
  console.log("typeHash", encodeType(primaryType))
  let typeHash = keccak256(toUtf8Bytes(encodeType(primaryType)));
  console.log("typeHash", typeHash)
  return typeHash;
}

function encodeData(primaryType, data) {
  let encTypes = [];
  let encValues = [];

  // Add typehash
  encTypes.push('bytes32');
  encValues.push(typeHash(primaryType));

  // Add field contents
  for (let field of types[primaryType]) {
    let value = data[field.name];
    if (field.type == 'string' || field.type == 'bytes') {
      encTypes.push('bytes32');
      value = ethUtil.keccakFromString(value);
      encValues.push(value);
    } else if (types[field.type] !== undefined) {
      encTypes.push('bytes32');
      value = ethUtil.keccak256(encodeData(field.type, value));
      encValues.push(value);
    } else if (field.type.lastIndexOf(']') === field.type.length - 1) {
      throw 'TODO: Arrays currently unimplemented in encodeData';
    } else {
      encTypes.push(field.type);
      encValues.push(value);
    }
  }

  let abiEncode = abi.rawEncode(encTypes, encValues);
  console.log(ethUtil.bufferToHex(abiEncode));
  return abiEncode;
}

function structHash(primaryType, data) {
  return ethUtil.keccak256(encodeData(primaryType, data));
}

function signHash(messageHash, chainId, verifyContract) {
 let domain = {
    name: CORESKE_HUB,
    version: EIP712_DOMAIN_VERSION,
    chainId: chainId || POLYGON_CHAIN_ID,
    verifyingContract: verifyContract,
  }

  return ethUtil.keccak256(
    Buffer.concat([
      Buffer.from('1901', 'hex'),
      structHash('EIP712Domain', domain),
      messageHash,
    ])
  );
}

describe('EIP712 compatible logic', async () => {
  it('Test the function of EIP712', async () => {

    const network = await provider.getNetwork();
    const chainId = network.chainId;
    console.log('chainId = ', network.chainId);

    const eip712Factory = await ethers.getContractFactory('MetaTxLib');
    let eip712Contract = await eip712Factory.deploy();
    await eip712Contract.deployed();
    console.log("MetaTxLib", eip712Contract.address)

    console.log("  SET_PROJECT_VOTE", SET_PROJECT_VOTE)
    console.log("getProjectVoteHash", await eip712Contract.getVoteHash())

    
    // Get test privatekey
    const privateKey = ethUtil.keccakFromString('cow');
    const targetAddress = "0x" + ethUtil.privateToAddress(privateKey).toString('hex');

    let nonce = parseInt(await coreskyHub.nonce())  + 1;
    let now = parseInt(new Date().getTime() / 1000);
    let deadline = now + 5*60;
    let serialNo = now;

    let supportCount = 50;
    let opposeCount = 10;
    let voteRatio = supportCount * 100 / (supportCount + opposeCount);
    voteRatio = parseInt(voteRatio);

    let expireTime = now + 10*60;
    /**
     * 
    struct ProjectVote{
        // 投票编号
        uint256 serialNo;
        // 项目方地址
        address projectAddr;
        // 支持数量
        uint256 supportCount;
        // 反对数量
        uint256 opposeCount;
        // 投票比率
        uint256 voteRatio;
        // 过期时间
        uint256 expireTime;
    }
     */
    let projectVote ={
      serialNo,
      projectAddr: targetAddress,
      supportCount,
      opposeCount,
      voteRatio,
      expireTime
    }

    let message = {
      ...projectVote,
      nonce,
      deadline,
    }
    
    let verifyContract = eip712Contract.address;
    let messageHash = structHash(typedData.primaryType, message);

    console.log("messageHash", ethUtil.bufferToHex(messageHash))
    let digest = signHash(messageHash, chainId, verifyContract);
    console.log("digest", ethUtil.bufferToHex(digest))
    const sig = ethUtil.ecsign(digest, privateKey);

    
/**
 *     struct EIP712Signature {
        address signer;
        uint8 v;
        bytes32 r;
        bytes32 s;
        uint256 deadline;
    }
 */
    let signature = {
       signer: targetAddress,
       v: sig.v,
       r: ethUtil.bufferToHex(sig.r),
       s: ethUtil.bufferToHex(sig.s),
       deadline
    }
    // console.log(eip712Contract)

// console.log("eip712Contract.verify:", signature, projectVote)
    let tx = await eip712Contract.verify(
          signature.signer,
          signature.v,
          signature.r,
          signature.s,
          signature.deadline,
          serialNo,
          targetAddress,
          supportCount,
          opposeCount,
          voteRatio,
          expireTime
        );

        console.log(tx)
    // expect(
    //   await eip712Contract.validateapplyProjectVoteSignature(
    //     signature,
    //     projectVote
    //   )
    // ).to.be.true;

    /* const privateKey = ethUtil.keccak256('cow');
        const address = ethUtil.privateToAddress(privateKey);
        const sig = ethUtil.ecsign(signHash(), privateKey);

        const expect = chai.expect;
        expect(encodeType('Mail')).to.equal('Mail(Person from,Person to,string contents)Person(string name,address wallet)');
        expect(ethUtil.bufferToHex(typeHash('Mail'))).to.equal(
            '0xa0cedeb2dc280ba39b857546d74f5549c3a1d7bdc2dd96bf881f76108e23dac2',
        );
        expect(ethUtil.bufferToHex(encodeData(typedData.primaryType, typedData.message))).to.equal(
            '0xa0cedeb2dc280ba39b857546d74f5549c3a1d7bdc2dd96bf881f76108e23dac2fc71e5fa27ff56c350aa531bc129ebdf613b772b6604664f5d8dbe21b85eb0c8cd54f074a4af31b4411ff6a60c9719dbd559c221c8ac3492d9d872b041d703d1b5aadf3154a261abdd9086fc627b61efca26ae5702701d05cd2305f7c52a2fc8',
        );
        expect(ethUtil.bufferToHex(structHash(typedData.primaryType, typedData.message))).to.equal(
            '0xc52c0ee5d84264471806290a3f2c4cecfc5490626bf912d01f240d7a274b371e',
        );
        expect(ethUtil.bufferToHex(structHash('EIP712Domain', typedData.domain))).to.equal(
            '0xf2cee375fa42b42143804025fc449deafd50cc031ca257e0b194a650a912090f',
        );
        expect(ethUtil.bufferToHex(signHash())).to.equal('0xbe609aee343fb3c4b28e1df9e632fca64fcfaede20f02e86244efddf30957bd2');
        expect(ethUtil.bufferToHex(address)).to.equal('0xcd2a3d9f938e13cd947ec05abc7fe734df8dd826');
        expect(sig.v).to.equal(28);
        expect(ethUtil.bufferToHex(sig.r)).to.equal('0x4355c47d63924e8a72e509b65029052eb6c299d53a04e167c5775fd466751c9d');
        expect(ethUtil.bufferToHex(sig.s)).to.equal('0x07299936d304c153f6443dfa05f40ff007d72911b6f72307f996231605b91562');

        console.log(process.env.PRIVATE_KEY); */
  });
});
