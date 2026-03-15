package service

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"

	"everdeploy/backend-go/internal/chain"
	"everdeploy/backend-go/internal/githubclone"
	"everdeploy/backend-go/internal/ipfs"
)

var (
	ErrInvalidRepoURL = errors.New("invalid repo URL")
	ErrInvalidLabel   = errors.New("invalid label")
	labelPattern      = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$|^[a-z0-9]$`)
)

type Input struct {
	RepoURL     string
	Label       string
	Meta        string
	GithubToken string
	DryRun      bool
}

type Output struct {
	RepoURL      string    `json:"repoUrl"`
	Label        string    `json:"label"`
	BuildDir     string    `json:"buildDir"`
	CID          string    `json:"cid"`
	Files        int       `json:"files"`
	TxHash       string    `json:"txHash"`
	BlockNumber  uint64    `json:"blockNumber"`
	DurationMS   int64     `json:"durationMs"`
	UploadedPath string    `json:"uploadedPath"`
	Timestamp    time.Time `json:"timestamp"`
}

type LoggerFunc func(string)

type Pipeline struct {
	cloner   *githubclone.DockerCloner
	uploader *ipfs.PinataClient
	chain    *chain.SubnameRegistryWriter
}

func NewPipeline(cloner *githubclone.DockerCloner, uploader *ipfs.PinataClient, chainWriter *chain.SubnameRegistryWriter) *Pipeline {
	return &Pipeline{cloner: cloner, uploader: uploader, chain: chainWriter}
}

func (p *Pipeline) Run(ctx context.Context, in Input) (Output, error) {
	return p.RunWithLogger(ctx, in, nil)
}

func (p *Pipeline) RunWithLogger(ctx context.Context, in Input, logger LoggerFunc) (Output, error) {
	log := func(msg string) {
		if logger != nil {
			logger(msg)
		}
	}

	if err := validateRepoURL(in.RepoURL); err != nil {
		return Output{}, fmt.Errorf("%w: %v", ErrInvalidRepoURL, err)
	}
	if err := validateLabel(in.Label); err != nil {
		return Output{}, fmt.Errorf("%w: %v", ErrInvalidLabel, err)
	}

	start := time.Now()
	log("starting deployment pipeline")
	log("cloning and building repository in a single isolated Docker container")

	cloneResult, buildDir, cleanup, err := p.cloner.CloneAndBuild(ctx, in.RepoURL, in.GithubToken)
	if err != nil {
		return Output{}, err
	}
	defer cleanup()
	log(fmt.Sprintf("clone and build completed: output=%s", buildDir))

	if in.DryRun {
		log("dryRun enabled: skipping IPFS upload and blockchain update")
		return Output{
			RepoURL:      in.RepoURL,
			Label:        in.Label,
			BuildDir:     buildDir,
			DurationMS:   time.Since(start).Milliseconds(),
			UploadedPath: buildDir,
			Timestamp:    time.Now().UTC(),
		}, nil
	}

	name := fmt.Sprintf("%s-%d", in.Label, time.Now().Unix())
	log("uploading repository files to IPFS via Pinata")
	upload, err := p.uploader.UploadDirectory(ctx, buildDir, name)
	if err != nil {
		return Output{}, err
	}
	log(fmt.Sprintf("ipfs upload completed: cid=%s files=%d", upload.CID, upload.FileCount))

	log("writing CID to SubnameRegistry.updateCID")
	tx, err := p.chain.UpdateCID(ctx, in.Label, upload.CID, in.Meta)
	if err != nil {
		return Output{}, err
	}
	log(fmt.Sprintf("on-chain update confirmed: tx=%s block=%d", tx.TxHash, tx.BlockNumber))
	log("deployment pipeline complete")

	return Output{
		RepoURL:      in.RepoURL,
		Label:        in.Label,
		BuildDir:     buildDir,
		CID:          upload.CID,
		Files:        upload.FileCount,
		TxHash:       tx.TxHash,
		BlockNumber:  tx.BlockNumber,
		DurationMS:   time.Since(start).Milliseconds(),
		UploadedPath: cloneResult.Path,
		Timestamp:    time.Now().UTC(),
	}, nil
}

func validateRepoURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return err
	}
	if !strings.EqualFold(u.Hostname(), "github.com") {
		return fmt.Errorf("only github.com URLs are supported")
	}
	if u.Scheme != "https" && u.Scheme != "http" {
		return fmt.Errorf("repo URL must be http/https")
	}
	parts := strings.Split(strings.Trim(strings.TrimPrefix(u.Path, "/"), "/"), "/")
	if len(parts) < 2 || parts[0] == "" || parts[1] == "" {
		return fmt.Errorf("repo URL must include owner and repository")
	}
	return nil
}

func validateLabel(label string) error {
	if !labelPattern.MatchString(label) {
		return fmt.Errorf("label must be lowercase alphanumeric or hyphen, 1-32 chars, no leading/trailing hyphen")
	}
	return nil
}
