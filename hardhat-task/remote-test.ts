import { BigNumber, Contract } from "ethers";
import { task } from "hardhat/config";

// import poolAbi from '../artifacts/contracts/InfinityPool.sol/InfinityPool.json';
const poolAbi = {abi:[
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "components": [
          {
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "indexed": false,
        "internalType": "struct IInfinityPool.TokenTransfer[]",
        "name": "transfers",
        "type": "tuple[]"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "action",
            "type": "uint256"
          },
          {
            "internalType": "uint256[]",
            "name": "parameters",
            "type": "uint256[]"
          }
        ],
        "indexed": false,
        "internalType": "struct IInfinityPool.Action[]",
        "name": "actions",
        "type": "tuple[]"
      }
    ],
    "name": "DepositsOrActionsTriggered",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "version",
        "type": "uint8"
      }
    ],
    "name": "Initialized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "protocolAddress",
        "type": "address"
      }
    ],
    "name": "LiquidationProtocolRegistered",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "key",
            "type": "uint256"
          },
          {
            "internalType": "uint64",
            "name": "value",
            "type": "uint64"
          }
        ],
        "indexed": false,
        "internalType": "struct IInfinityPool.PriceIndex[]",
        "name": "priceIndexes",
        "type": "tuple[]"
      }
    ],
    "name": "PriceIndexesUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "components": [
          {
            "internalType": "uint64",
            "name": "key",
            "type": "uint64"
          },
          {
            "internalType": "int64",
            "name": "value",
            "type": "int64"
          }
        ],
        "indexed": false,
        "internalType": "struct IInfinityPool.ProductVariable[]",
        "name": "variables",
        "type": "tuple[]"
      }
    ],
    "name": "ProductVariablesUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "clientAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "tokenFrom",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amountIn",
        "type": "uint256"
      },
      {
        "components": [
          {
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "indexed": false,
        "internalType": "struct ILiquidationProtocol.LiquidatedAmount[]",
        "name": "amounts",
        "type": "tuple[]"
      }
    ],
    "name": "ServerLiquidateSuccess",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "components": [
          {
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "indexed": false,
        "internalType": "struct IInfinityPool.TokenTransfer[]",
        "name": "transfers",
        "type": "tuple[]"
      }
    ],
    "name": "WithdrawalRequested",
    "type": "event"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "action",
            "type": "uint256"
          },
          {
            "internalType": "uint256[]",
            "name": "parameters",
            "type": "uint256[]"
          }
        ],
        "internalType": "struct IInfinityPool.Action[]",
        "name": "actions",
        "type": "tuple[]"
      }
    ],
    "name": "action",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "clientAddress",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "balance",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "internalType": "struct IInfinityPool.TokenTransfer[]",
        "name": "tokenTransfers",
        "type": "tuple[]"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "action",
            "type": "uint256"
          },
          {
            "internalType": "uint256[]",
            "name": "parameters",
            "type": "uint256[]"
          }
        ],
        "internalType": "struct IInfinityPool.Action[]",
        "name": "actions",
        "type": "tuple[]"
      }
    ],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_addrPoolToken",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_addrWETH",
        "type": "address"
      }
    ],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      }
    ],
    "name": "onERC721Received",
    "outputs": [
      {
        "internalType": "bytes4",
        "name": "",
        "type": "bytes4"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "poolToken",
    "outputs": [
      {
        "internalType": "contract IInfinityToken",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "priceIndex",
    "outputs": [
      {
        "internalType": "uint64",
        "name": "value",
        "type": "uint64"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "id",
        "type": "uint64"
      }
    ],
    "name": "productVariable",
    "outputs": [
      {
        "internalType": "int64",
        "name": "value",
        "type": "int64"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "protocolId",
        "type": "uint64"
      },
      {
        "internalType": "address",
        "name": "protocolAddress",
        "type": "address"
      }
    ],
    "name": "registerLiquidationProtocol",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "internalType": "struct IInfinityPool.TokenTransfer[]",
        "name": "tokenTransfers",
        "type": "tuple[]"
      }
    ],
    "name": "requestWithdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "protocolId",
        "type": "uint64"
      },
      {
        "components": [
          {
            "internalType": "address",
            "name": "clientAddress",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "tokenFrom",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "tokenTo",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amountIn",
            "type": "uint256"
          },
          {
            "internalType": "uint24",
            "name": "poolFee",
            "type": "uint24"
          }
        ],
        "internalType": "struct ILiquidationProtocol.LiquidateParams",
        "name": "lparams",
        "type": "tuple"
      }
    ],
    "name": "serverLiquidate",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "protocolId",
        "type": "uint64"
      },
      {
        "components": [
          {
            "internalType": "address",
            "name": "clientAddress",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "tokenFrom",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "tokenTo",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amountIn",
            "type": "uint256"
          },
          {
            "internalType": "uint24",
            "name": "poolFee",
            "type": "uint24"
          }
        ],
        "internalType": "struct ILiquidationProtocol.LiquidateParams",
        "name": "lparams",
        "type": "tuple"
      }
    ],
    "name": "serverLiquidateERC721",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "clientAddress",
        "type": "address"
      },
      {
        "components": [
          {
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "internalType": "struct IInfinityPool.TokenTransfer[]",
        "name": "tokenTransfers",
        "type": "tuple[]"
      }
    ],
    "name": "serverTransferFunds",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "clientAddresses",
        "type": "address[]"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "tokenId",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "uint64",
            "name": "priceIndex",
            "type": "uint64"
          }
        ],
        "internalType": "struct IInfinityPool.TokenUpdate[][]",
        "name": "tokenUpdates",
        "type": "tuple[][]"
      },
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "key",
            "type": "uint256"
          },
          {
            "internalType": "uint64",
            "name": "value",
            "type": "uint64"
          }
        ],
        "internalType": "struct IInfinityPool.PriceIndex[]",
        "name": "_priceIndexes",
        "type": "tuple[]"
      }
    ],
    "name": "serverUpdateBalances",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "uint64",
            "name": "key",
            "type": "uint64"
          },
          {
            "internalType": "int64",
            "name": "value",
            "type": "int64"
          }
        ],
        "internalType": "struct IInfinityPool.ProductVariable[]",
        "name": "_productVariables",
        "type": "tuple[]"
      }
    ],
    "name": "serverUpdateProductVariables",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_addrPoolToken",
        "type": "address"
      }
    ],
    "name": "setInfinityToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_addrWETH",
        "type": "address"
      }
    ],
    "name": "setWETH",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "version",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "v",
        "type": "uint256"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "weth",
    "outputs": [
      {
        "internalType": "contract IWETH",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
]};
const ERC20Artifact = {
  "_format": "hh-sol-artifact-1",
  "contractName": "ERC20",
  "sourceName": "contracts/token/ERC20/ERC20.sol",
  "abi": [
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "name_",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "symbol_",
          "type": "string"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "owner",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "spender",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "Approval",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "Transfer",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "spender",
          "type": "address"
        }
      ],
      "name": "allowance",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "spender",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "approve",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "account",
          "type": "address"
        }
      ],
      "name": "balanceOf",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "decimals",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "spender",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "subtractedValue",
          "type": "uint256"
        }
      ],
      "name": "decreaseAllowance",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "spender",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "addedValue",
          "type": "uint256"
        }
      ],
      "name": "increaseAllowance",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "name",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "symbol",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "totalSupply",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "recipient",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "transfer",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "sender",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "recipient",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "transferFrom",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ],
  "bytecode": "0x60806040523480156200001157600080fd5b5060405162000b4b38038062000b4b8339810160408190526200003491620001c1565b81516200004990600390602085019062000068565b5080516200005f90600490602084019062000068565b5050506200027b565b828054620000769062000228565b90600052602060002090601f0160209004810192826200009a5760008555620000e5565b82601f10620000b557805160ff1916838001178555620000e5565b82800160010185558215620000e5579182015b82811115620000e5578251825591602001919060010190620000c8565b50620000f3929150620000f7565b5090565b5b80821115620000f35760008155600101620000f8565b600082601f8301126200011f578081fd5b81516001600160401b03808211156200013c576200013c62000265565b604051601f8301601f19908116603f0116810190828211818310171562000167576200016762000265565b8160405283815260209250868385880101111562000183578485fd5b8491505b83821015620001a6578582018301518183018401529082019062000187565b83821115620001b757848385830101525b9695505050505050565b60008060408385031215620001d4578182fd5b82516001600160401b0380821115620001eb578384fd5b620001f9868387016200010e565b935060208501519150808211156200020f578283fd5b506200021e858286016200010e565b9150509250929050565b600181811c908216806200023d57607f821691505b602082108114156200025f57634e487b7160e01b600052602260045260246000fd5b50919050565b634e487b7160e01b600052604160045260246000fd5b6108c0806200028b6000396000f3fe608060405234801561001057600080fd5b50600436106100a95760003560e01c80633950935111610071578063395093511461012357806370a082311461013657806395d89b4114610149578063a457c2d714610151578063a9059cbb14610164578063dd62ed3e14610177576100a9565b806306fdde03146100ae578063095ea7b3146100cc57806318160ddd146100ef57806323b872dd14610101578063313ce56714610114575b600080fd5b6100b66101b0565b6040516100c391906107d8565b60405180910390f35b6100df6100da3660046107af565b610242565b60405190151581526020016100c3565b6002545b6040519081526020016100c3565b6100df61010f366004610774565b610258565b604051601281526020016100c3565b6100df6101313660046107af565b610307565b6100f3610144366004610721565b610343565b6100b6610362565b6100df61015f3660046107af565b610371565b6100df6101723660046107af565b61040a565b6100f3610185366004610742565b6001600160a01b03918216600090815260016020908152604080832093909416825291909152205490565b6060600380546101bf9061084f565b80601f01602080910402602001604051908101604052809291908181526020018280546101eb9061084f565b80156102385780601f1061020d57610100808354040283529160200191610238565b820191906000526020600020905b81548152906001019060200180831161021b57829003601f168201915b5050505050905090565b600061024f338484610417565b50600192915050565b600061026584848461053b565b6001600160a01b0384166000908152600160209081526040808320338452909152902054828110156102ef5760405162461bcd60e51b815260206004820152602860248201527f45524332303a207472616e7366657220616d6f756e74206578636565647320616044820152676c6c6f77616e636560c01b60648201526084015b60405180910390fd5b6102fc8533858403610417565b506001949350505050565b3360008181526001602090815260408083206001600160a01b0387168452909152812054909161024f91859061033e90869061082b565b610417565b6001600160a01b0381166000908152602081905260409020545b919050565b6060600480546101bf9061084f565b3360009081526001602090815260408083206001600160a01b0386168452909152812054828110156103f35760405162461bcd60e51b815260206004820152602560248201527f45524332303a2064656372656173656420616c6c6f77616e63652062656c6f77604482015264207a65726f60d81b60648201526084016102e6565b6104003385858403610417565b5060019392505050565b600061024f33848461053b565b6001600160a01b0383166104795760405162461bcd60e51b8152602060048201526024808201527f45524332303a20617070726f76652066726f6d20746865207a65726f206164646044820152637265737360e01b60648201526084016102e6565b6001600160a01b0382166104da5760405162461bcd60e51b815260206004820152602260248201527f45524332303a20617070726f766520746f20746865207a65726f206164647265604482015261737360f01b60648201526084016102e6565b6001600160a01b0383811660008181526001602090815260408083209487168084529482529182902085905590518481527f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925910160405180910390a3505050565b6001600160a01b03831661059f5760405162461bcd60e51b815260206004820152602560248201527f45524332303a207472616e736665722066726f6d20746865207a65726f206164604482015264647265737360d81b60648201526084016102e6565b6001600160a01b0382166106015760405162461bcd60e51b815260206004820152602360248201527f45524332303a207472616e7366657220746f20746865207a65726f206164647260448201526265737360e81b60648201526084016102e6565b6001600160a01b038316600090815260208190526040902054818110156106795760405162461bcd60e51b815260206004820152602660248201527f45524332303a207472616e7366657220616d6f756e7420657863656564732062604482015265616c616e636560d01b60648201526084016102e6565b6001600160a01b038085166000908152602081905260408082208585039055918516815290812080548492906106b090849061082b565b92505081905550826001600160a01b0316846001600160a01b03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040516106fc91815260200190565b60405180910390a350505050565b80356001600160a01b038116811461035d57600080fd5b600060208284031215610732578081fd5b61073b8261070a565b9392505050565b60008060408385031215610754578081fd5b61075d8361070a565b915061076b6020840161070a565b90509250929050565b600080600060608486031215610788578081fd5b6107918461070a565b925061079f6020850161070a565b9150604084013590509250925092565b600080604083850312156107c1578182fd5b6107ca8361070a565b946020939093013593505050565b6000602080835283518082850152825b81811015610804578581018301518582016040015282016107e8565b818111156108155783604083870101525b50601f01601f1916929092016040019392505050565b6000821982111561084a57634e487b7160e01b81526011600452602481fd5b500190565b600181811c9082168061086357607f821691505b6020821081141561088457634e487b7160e01b600052602260045260246000fd5b5091905056fea2646970667358221220d5fe2a4e17ce9d022007f408350bf2342a192449074b95d77ad2ccae63966f1064736f6c63430008030033",
  "deployedBytecode": "0x608060405234801561001057600080fd5b50600436106100a95760003560e01c80633950935111610071578063395093511461012357806370a082311461013657806395d89b4114610149578063a457c2d714610151578063a9059cbb14610164578063dd62ed3e14610177576100a9565b806306fdde03146100ae578063095ea7b3146100cc57806318160ddd146100ef57806323b872dd14610101578063313ce56714610114575b600080fd5b6100b66101b0565b6040516100c391906107d8565b60405180910390f35b6100df6100da3660046107af565b610242565b60405190151581526020016100c3565b6002545b6040519081526020016100c3565b6100df61010f366004610774565b610258565b604051601281526020016100c3565b6100df6101313660046107af565b610307565b6100f3610144366004610721565b610343565b6100b6610362565b6100df61015f3660046107af565b610371565b6100df6101723660046107af565b61040a565b6100f3610185366004610742565b6001600160a01b03918216600090815260016020908152604080832093909416825291909152205490565b6060600380546101bf9061084f565b80601f01602080910402602001604051908101604052809291908181526020018280546101eb9061084f565b80156102385780601f1061020d57610100808354040283529160200191610238565b820191906000526020600020905b81548152906001019060200180831161021b57829003601f168201915b5050505050905090565b600061024f338484610417565b50600192915050565b600061026584848461053b565b6001600160a01b0384166000908152600160209081526040808320338452909152902054828110156102ef5760405162461bcd60e51b815260206004820152602860248201527f45524332303a207472616e7366657220616d6f756e74206578636565647320616044820152676c6c6f77616e636560c01b60648201526084015b60405180910390fd5b6102fc8533858403610417565b506001949350505050565b3360008181526001602090815260408083206001600160a01b0387168452909152812054909161024f91859061033e90869061082b565b610417565b6001600160a01b0381166000908152602081905260409020545b919050565b6060600480546101bf9061084f565b3360009081526001602090815260408083206001600160a01b0386168452909152812054828110156103f35760405162461bcd60e51b815260206004820152602560248201527f45524332303a2064656372656173656420616c6c6f77616e63652062656c6f77604482015264207a65726f60d81b60648201526084016102e6565b6104003385858403610417565b5060019392505050565b600061024f33848461053b565b6001600160a01b0383166104795760405162461bcd60e51b8152602060048201526024808201527f45524332303a20617070726f76652066726f6d20746865207a65726f206164646044820152637265737360e01b60648201526084016102e6565b6001600160a01b0382166104da5760405162461bcd60e51b815260206004820152602260248201527f45524332303a20617070726f766520746f20746865207a65726f206164647265604482015261737360f01b60648201526084016102e6565b6001600160a01b0383811660008181526001602090815260408083209487168084529482529182902085905590518481527f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925910160405180910390a3505050565b6001600160a01b03831661059f5760405162461bcd60e51b815260206004820152602560248201527f45524332303a207472616e736665722066726f6d20746865207a65726f206164604482015264647265737360d81b60648201526084016102e6565b6001600160a01b0382166106015760405162461bcd60e51b815260206004820152602360248201527f45524332303a207472616e7366657220746f20746865207a65726f206164647260448201526265737360e81b60648201526084016102e6565b6001600160a01b038316600090815260208190526040902054818110156106795760405162461bcd60e51b815260206004820152602660248201527f45524332303a207472616e7366657220616d6f756e7420657863656564732062604482015265616c616e636560d01b60648201526084016102e6565b6001600160a01b038085166000908152602081905260408082208585039055918516815290812080548492906106b090849061082b565b92505081905550826001600160a01b0316846001600160a01b03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040516106fc91815260200190565b60405180910390a350505050565b80356001600160a01b038116811461035d57600080fd5b600060208284031215610732578081fd5b61073b8261070a565b9392505050565b60008060408385031215610754578081fd5b61075d8361070a565b915061076b6020840161070a565b90509250929050565b600080600060608486031215610788578081fd5b6107918461070a565b925061079f6020850161070a565b9150604084013590509250925092565b600080604083850312156107c1578182fd5b6107ca8361070a565b946020939093013593505050565b6000602080835283518082850152825b81811015610804578581018301518582016040015282016107e8565b818111156108155783604083870101525b50601f01601f1916929092016040019392505050565b6000821982111561084a57634e487b7160e01b81526011600452602481fd5b500190565b600181811c9082168061086357607f821691505b6020821081141561088457634e487b7160e01b600052602260045260246000fd5b5091905056fea2646970667358221220d5fe2a4e17ce9d022007f408350bf2342a192449074b95d77ad2ccae63966f1064736f6c63430008030033",
  "linkReferences": {},
  "deployedLinkReferences": {}
};
const WETH_TOKEN_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const DAI_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const WBTC_ADDRESS = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';

task('remote-test', 'Remote Test')
.addOptionalParam("poolAddress","Address of Infinity Pool Contract. Uses ENV.INFINITY_POOL_ADDRESS by default.",process.env.INFINITY_POOL_ADDRESS)
.addOptionalParam("forceImport")
.addOptionalParam("impersonateOwner")
.setAction(async(taskArgs, hre) => {
	const { ethers, network, upgrades } = hre;
  const { poolAddress } = taskArgs;
  console.log('poolAddress',poolAddress);
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');
	console.log('before:',await ethers.provider.getBlockNumber());
	console.log('chainId',await ethers.provider.getNetwork());
  // balance address
	const contractDai = new Contract(DAI_ADDRESS, ERC20Artifact.abi, ethers.provider);
	const contractUsdc = new Contract(USDC_ADDRESS, ERC20Artifact.abi, ethers.provider);
	const contractUsdt = new Contract(USDT_ADDRESS, ERC20Artifact.abi, ethers.provider);
	const contractWbtc = new Contract(WBTC_ADDRESS, ERC20Artifact.abi, ethers.provider);
	const contractWeth = new Contract(WETH_TOKEN_ADDRESS, ERC20Artifact.abi, ethers.provider);
	// const uniswapDaiBalance = await contractDai.balanceOf('0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984');//0x60594a405d53811d3bc4766596efd80fd545a270');
	// const uniswapUsdcBalance = await contractUsdc.balanceOf('0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984');//0x60594a405d53811d3bc4766596efd80fd545a270');
	// console.log('uniswapDaiBalance',(uniswapDaiBalance.toString()));
  // pool check
  const poolContract = new Contract(poolAddress, poolAbi.abi, ethers.provider); 
  console.log('InfinityToken',await poolContract.poolToken());
  const owner = await poolContract.owner();
	console.log('owner',owner);
  const testBalance = await poolContract.balanceOf('0x0000000000000000000000000000000000000001',0);
	console.log('testBalance',(testBalance.toString()));
	console.log('Balance');
	console.log((await Promise.all([
		contractDai.balanceOf(poolAddress).then((balance:any) => ('--Pool DAI: ' + balance)),
		contractUsdc.balanceOf(poolAddress).then((balance:any) => ('--Pool USDC: ' + balance)),
		contractUsdt.balanceOf(poolAddress).then((balance:any) => ('--Pool USDT: ' + balance)),
		contractWbtc.balanceOf(poolAddress).then((balance:any) => ('--Pool WBTC: ' + balance)),
		contractWeth.balanceOf(poolAddress).then((balance:any) => ('--Pool WETH: ' + balance)),
		ethers.provider.getBalance(poolAddress).then((balance:any) => ('--Pool ETH: ' + balance)),
	])).join('\n'));


  // pool owner
  const ownerSigner = await ethers.getSigner(owner);
  await network.provider.request({method:"hardhat_impersonateAccount",params:[owner]});
  // change proxy admin
  // const res = await upgrades.admin.changeProxyAdmin('0xb185E9f6531BA9877741022C92CE858cDCc5760E','0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
  // console.log(res);

  // transfer ownership
  // const transferReceipt = await poolContract.connect(ownerSigner).transferOwnership('0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199');
  // console.log('transferReceipt',transferReceipt);
  // const liquidate = async()=>{
  //   // liquidation
  //   const walletAddress = '0x5d38b4e4783e34e2301a2a36c39a03c45798c4dd';
  //   // const walletSigner = await ethers.getSigner(walletAddress);
  //   // await network.provider.request({method:"hardhat_impersonateAccount",params:[walletAddress]});
  //   // provider.on({
  //   //   address: poolAddress,
  //   //   topics: [
  //   //       ethers.utils.id("ServerLiquidateSuccess(address,address,address,uint256,uint256)")
  //   //   ]
  //   // }, () => {
  //   //   console.log();
  //   // })
  //   await poolContract.on("ServerLiquidateSuccess",(clientAddress,tokenFrom,tokenTo,amountIn,amountOut)=>{
  //     console.log('ServerLiquidateSuccess',clientAddress,tokenFrom,tokenTo,(amountIn.toString()),(amountOut.toString()));
  //   });
  //   console.log('wallet dai:',((await contractDai.balanceOf(walletAddress)).toString()),
  //     'usdc:',((await contractUsdc.balanceOf(walletAddress)).toString())
  //   );
  //   console.log('ServerLiquidate');
  //   await poolContract.connect(ownerSigner).serverLiquidate(1,[walletAddress,daiAddress,usdcAddress,BigNumber.from('1000000000000000000'),3000]);
  //   console.log('wallet dai:',((await contractDai.balanceOf(walletAddress)).toString()),
  //     'usdc:',((await contractUsdc.balanceOf(walletAddress)).toString())
  //   );
  // }
  // const updatePriceIndex = async()=>{
  //   const PRICE_INDEX_ID = '0x'+'01'+DAI_ADDRESS.slice(2);
  //   console.log('priceIndex',PRICE_INDEX_ID,(await poolContract.priceIndex(PRICE_INDEX_ID)));
  //   const PRICE_INDEX = BigNumber.from(1.21*1e13);
  //   await poolContract.connect(ownerSigner).serverUpdateBalances(
  //     [],[],
  //     [{key:PRICE_INDEX_ID,value:PRICE_INDEX}]
  //   );
  //   console.log('priceIndex',PRICE_INDEX_ID,(await poolContract.priceIndex(PRICE_INDEX_ID)));
  // }

  // await updatePriceIndex();
  // await liquidate();

	// increase block
	console.log('-- mine 15 blocks for job server');
	for(let i=0;i<15;i++){
		await network.provider.send("evm_mine");
	}
	
	console.log('after:',await ethers.provider.getBlockNumber());
});
