package chain

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

const subnameRegistryABI = `[
  {
    "inputs": [
      {"internalType":"string","name":"label","type":"string"},
      {"internalType":"bytes","name":"cid","type":"bytes"},
      {"internalType":"string","name":"meta","type":"string"}
    ],
    "name":"updateCID",
    "outputs":[],
    "stateMutability":"nonpayable",
    "type":"function"
  }
]`

type SubnameRegistryWriter struct {
	client   *ethclient.Client
	contract *bind.BoundContract
	key      *ecdsa.PrivateKey
	chainID  *big.Int
	timeout  time.Duration
}

type TxResult struct {
	TxHash      string `json:"txHash"`
	BlockNumber uint64 `json:"blockNumber"`
}

func NewSubnameRegistryWriter(rpcURL, privateKeyHex, contractAddress string, chainID *big.Int, timeout time.Duration) (*SubnameRegistryWriter, error) {
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, fmt.Errorf("dial rpc: %w", err)
	}

	abiDef, err := abi.JSON(strings.NewReader(subnameRegistryABI))
	if err != nil {
		return nil, fmt.Errorf("parse abi: %w", err)
	}

	key, err := crypto.HexToECDSA(strings.TrimPrefix(privateKeyHex, "0x"))
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}

	addr := common.HexToAddress(contractAddress)
	contract := bind.NewBoundContract(addr, abiDef, client, client, client)

	return &SubnameRegistryWriter{
		client:   client,
		contract: contract,
		key:      key,
		chainID:  chainID,
		timeout:  timeout,
	}, nil
}

func (w *SubnameRegistryWriter) UpdateCID(ctx context.Context, label, cid, meta string) (TxResult, error) {
	txCtx, cancel := context.WithTimeout(ctx, w.timeout)
	defer cancel()

	auth, err := bind.NewKeyedTransactorWithChainID(w.key, w.chainID)
	if err != nil {
		return TxResult{}, fmt.Errorf("create transactor: %w", err)
	}
	auth.Context = txCtx

	tx, err := w.contract.Transact(auth, "updateCID", label, []byte(cid), meta)
	if err != nil {
		return TxResult{}, fmt.Errorf("send updateCID tx: %w", err)
	}

	receipt, err := bind.WaitMined(txCtx, w.client, tx)
	if err != nil {
		return TxResult{}, fmt.Errorf("wait tx mined: %w", err)
	}
	if receipt.Status != types.ReceiptStatusSuccessful {
		return TxResult{}, fmt.Errorf("updateCID tx reverted: %s", tx.Hash().Hex())
	}

	return TxResult{
		TxHash:      tx.Hash().Hex(),
		BlockNumber: receipt.BlockNumber.Uint64(),
	}, nil
}
