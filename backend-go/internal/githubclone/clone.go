package githubclone

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type Result struct {
	Path     string
	CloneURL string
	Branch   string
	SubDir   string
}

type DockerCloner struct {
	dockerImage  string
	timeout      time.Duration
	buildTimeout time.Duration
	buildImage   string
}

func NewDockerCloner(dockerImage string, timeout time.Duration, buildTimeout time.Duration) *DockerCloner {
	if buildTimeout <= 0 {
		buildTimeout = 30 * time.Minute
	}
	return &DockerCloner{dockerImage: dockerImage, timeout: timeout, buildTimeout: buildTimeout, buildImage: "node:20-alpine"}
}

func (c *DockerCloner) SetBuildImage(image string) {
	if strings.TrimSpace(image) != "" {
		c.buildImage = image
	}
}

func (c *DockerCloner) Clone(ctx context.Context, rawRepoURL, githubToken string) (Result, func(), error) {
	parsed, err := parseRepoURL(rawRepoURL)
	if err != nil {
		return Result{}, nil, err
	}

	tmpDir, err := os.MkdirTemp("", "backend-go-clone-*")
	if err != nil {
		return Result{}, nil, fmt.Errorf("create temp dir: %w", err)
	}
	cleanup := func() { _ = os.RemoveAll(tmpDir) }

	cloneCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	targetInContainer := "/work/repo"
	args := []string{
		"run", "--rm",
		"--memory", "512m",
		"--cpus", "1.0",
		"--pids-limit", "256",
		"--cap-drop", "ALL",
		"--security-opt", "no-new-privileges",
		"-v", fmt.Sprintf("%s:/work", tmpDir),
		"-w", "/work",
		c.dockerImage,
		"clone", "--depth", "1",
	}

	if parsed.Branch != "" {
		args = append(args, "--branch", parsed.Branch)
	}
	if githubToken != "" && isGitHubURL(parsed.CloneURL) {
		args = append(args, "--config", fmt.Sprintf("http.https://github.com/.extraheader=%s", tokenExtraHeader(githubToken)))
	}

	args = append(args, parsed.CloneURL, targetInContainer)

	cmd := exec.CommandContext(cloneCtx, "docker", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		cleanup()
		return Result{}, nil, fmt.Errorf("docker git clone failed: %v: %s", err, strings.TrimSpace(string(output)))
	}

	hostRepoPath := filepath.Join(tmpDir, "repo")
	finalPath := hostRepoPath
	if parsed.SubDir != "" {
		finalPath = filepath.Join(hostRepoPath, filepath.FromSlash(parsed.SubDir))
		if st, statErr := os.Stat(finalPath); statErr != nil || !st.IsDir() {
			cleanup()
			return Result{}, nil, fmt.Errorf("subdirectory not found in repo: %s", parsed.SubDir)
		}
	}

	return Result{
		Path:     finalPath,
		CloneURL: parsed.CloneURL,
		Branch:   parsed.Branch,
		SubDir:   parsed.SubDir,
	}, cleanup, nil
}

type parsedRepoURL struct {
	CloneURL string
	Branch   string
	SubDir   string
}

func parseRepoURL(raw string) (parsedRepoURL, error) {
	u, err := url.Parse(raw)
	if err != nil {
		return parsedRepoURL{}, fmt.Errorf("invalid repoUrl: %w", err)
	}
	if u.Scheme != "https" && u.Scheme != "http" {
		return parsedRepoURL{}, fmt.Errorf("repoUrl must start with http:// or https://")
	}
	if !strings.EqualFold(u.Hostname(), "github.com") {
		return parsedRepoURL{}, fmt.Errorf("only github.com repositories are supported")
	}

	parts := strings.Split(strings.Trim(strings.TrimPrefix(u.Path, "/"), "/"), "/")
	if len(parts) < 2 {
		return parsedRepoURL{}, fmt.Errorf("repoUrl must include owner and repository")
	}

	owner := parts[0]
	repo := strings.TrimSuffix(parts[1], ".git")
	if owner == "" || repo == "" {
		return parsedRepoURL{}, fmt.Errorf("invalid GitHub repository path")
	}

	parsed := parsedRepoURL{CloneURL: fmt.Sprintf("https://github.com/%s/%s.git", owner, repo)}
	if len(parts) >= 4 && parts[2] == "tree" {
		parsed.Branch = parts[3]
		if len(parts) > 4 {
			parsed.SubDir = strings.Join(parts[4:], "/")
		}
	}

	return parsed, nil
}

func isGitHubURL(cloneURL string) bool {
	return strings.HasPrefix(strings.ToLower(cloneURL), "https://github.com/")
}

func tokenExtraHeader(token string) string {
	basic := base64.StdEncoding.EncodeToString([]byte("x-access-token:" + token))
	return "AUTHORIZATION: basic " + basic
}

func (c *DockerCloner) CloneAndBuild(ctx context.Context, rawRepoURL, githubToken string) (Result, string, func(), error) {
	parsed, err := parseRepoURL(rawRepoURL)
	if err != nil {
		return Result{}, "", nil, err
	}

	tmpDir, err := os.MkdirTemp("", "backend-go-run-*")
	if err != nil {
		return Result{}, "", nil, fmt.Errorf("create temp dir: %w", err)
	}
	cleanup := func() { _ = os.RemoveAll(tmpDir) }

	runCtx, cancel := context.WithTimeout(ctx, c.buildTimeout)
	defer cancel()

	cloneCmd := "git clone --depth 1"
	if parsed.Branch != "" {
		cloneCmd += " --branch " + shQuote(parsed.Branch)
	}
	if githubToken != "" && isGitHubURL(parsed.CloneURL) {
		cloneCmd += " --config " + shQuote("http.https://github.com/.extraheader="+tokenExtraHeader(githubToken))
	}
	cloneCmd += " " + shQuote(parsed.CloneURL) + " /work/repo"

	script := strings.Join([]string{
		"set -eu",
		"apk add --no-cache git >/dev/null",
		cloneCmd,
		"SUBPATH=" + shQuote(strings.Trim(parsed.SubDir, "/")),
		"if [ -n \"$SUBPATH\" ] && [ ! -d \"/work/repo/$SUBPATH\" ]; then echo \"subdirectory not found: $SUBPATH\"; exit 1; fi",
		"if [ -n \"$SUBPATH\" ]; then cd \"/work/repo/$SUBPATH\"; else cd /work/repo; fi",
		"if [ ! -f package.json ]; then echo 'package.json not found'; exit 1; fi",
		"if [ -f pnpm-lock.yaml ]; then corepack enable; pnpm install --frozen-lockfile || pnpm install; pnpm run build;",
		"elif [ -f yarn.lock ]; then corepack enable; yarn install --frozen-lockfile || yarn install; yarn build;",
		"elif [ -f package-lock.json ]; then npm ci || npm install; npm run build;",
		"else npm install; npm run build; fi",
		"# If build produced .next but not out, try static export for flatter IPFS-friendly output",
		"if [ -d .next ] && [ ! -d out ]; then",
		"  if node -e \"const p=require('./package.json');process.exit(p.scripts&&p.scripts.export?0:1)\"; then",
		"    if [ -f pnpm-lock.yaml ]; then pnpm run export || true;",
		"    elif [ -f yarn.lock ]; then yarn export || true;",
		"    else npm run export || true; fi",
		"  fi",
		"fi",
		"if [ -d out ]; then OUTDIR=out;",
		"elif [ -d dist ]; then OUTDIR=dist;",
		"elif [ -d build ]; then OUTDIR=build;",
		"elif [ -d .next ]; then OUTDIR=.next;",
		"else echo 'no build output dir found (out|dist|build|.next)'; exit 1; fi",
		"if [ -n \"$SUBPATH\" ]; then echo \"$SUBPATH/$OUTDIR\" > /work/.builddir; else echo \"$OUTDIR\" > /work/.builddir; fi",
	}, "\n")

	args := []string{
		"run", "--rm",
		"--memory", "2g",
		"--cpus", "2.0",
		"--pids-limit", "512",
		"--cap-drop", "ALL",
		"--security-opt", "no-new-privileges",
		"-v", fmt.Sprintf("%s:/work", filepath.Clean(tmpDir)),
		"-w", "/work",
		c.buildImage,
		"sh", "-lc", script,
	}

	cmd := exec.CommandContext(runCtx, "docker", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		cleanup()
		return Result{}, "", nil, fmt.Errorf("docker clone+build failed: %v: %s", err, strings.TrimSpace(string(output)))
	}

	hostRepoPath := filepath.Join(tmpDir, "repo")
	resultPath := hostRepoPath
	if parsed.SubDir != "" {
		resultPath = filepath.Join(hostRepoPath, filepath.FromSlash(parsed.SubDir))
	}

	buildDirMarker := filepath.Join(tmpDir, ".builddir")
	raw, err := os.ReadFile(buildDirMarker)
	if err != nil {
		cleanup()
		return Result{}, "", nil, fmt.Errorf("read build output marker: %w", err)
	}
	_ = os.Remove(buildDirMarker)

	rel := strings.TrimSpace(string(raw))
	if rel == "" {
		cleanup()
		return Result{}, "", nil, fmt.Errorf("build output marker was empty")
	}

	buildPath := filepath.Join(hostRepoPath, filepath.FromSlash(rel))
	st, err := os.Stat(buildPath)
	if err != nil || !st.IsDir() {
		cleanup()
		return Result{}, "", nil, fmt.Errorf("detected build output does not exist: %s", rel)
	}

	return Result{
		Path:     resultPath,
		CloneURL: parsed.CloneURL,
		Branch:   parsed.Branch,
		SubDir:   parsed.SubDir,
	}, buildPath, cleanup, nil
}

func shQuote(s string) string {
	if s == "" {
		return "''"
	}
	return "'" + strings.ReplaceAll(s, "'", "'\"'\"'") + "'"
}

func (c *DockerCloner) Build(ctx context.Context, repoPath string) (string, error) {
	buildCtx, cancel := context.WithTimeout(ctx, c.buildTimeout)
	defer cancel()

	script := strings.Join([]string{
		"set -eu",
		"cd /work/repo",
		"if [ ! -f package.json ]; then echo 'package.json not found'; exit 1; fi",
		"if [ -f pnpm-lock.yaml ]; then corepack enable; pnpm install --frozen-lockfile || pnpm install; pnpm run build;",
		"elif [ -f yarn.lock ]; then corepack enable; yarn install --frozen-lockfile || yarn install; yarn build;",
		"elif [ -f package-lock.json ]; then npm ci || npm install; npm run build;",
		"else npm install; npm run build; fi",
		"if [ -d out ]; then echo out > /work/repo/.builddir;",
		"elif [ -d dist ]; then echo dist > /work/repo/.builddir;",
		"elif [ -d build ]; then echo build > /work/repo/.builddir;",
		"elif [ -d .next ]; then echo .next > /work/repo/.builddir;",
		"else echo 'no build output dir found (out|dist|build|.next)'; exit 1; fi",
	}, "\n")

	args := []string{
		"run", "--rm",
		"--memory", "2g",
		"--cpus", "2.0",
		"--pids-limit", "512",
		"--cap-drop", "ALL",
		"--security-opt", "no-new-privileges",
		"-v", fmt.Sprintf("%s:/work/repo", filepath.Clean(repoPath)),
		"-w", "/work/repo",
		c.buildImage,
		"sh", "-lc", script,
	}

	cmd := exec.CommandContext(buildCtx, "docker", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("docker build failed: %v: %s", err, strings.TrimSpace(string(output)))
	}

	buildDirMarker := filepath.Join(repoPath, ".builddir")
	raw, err := os.ReadFile(buildDirMarker)
	if err != nil {
		return "", fmt.Errorf("read build output marker: %w", err)
	}
	_ = os.Remove(buildDirMarker)

	rel := strings.TrimSpace(string(raw))
	if rel == "" {
		return "", fmt.Errorf("build output marker was empty")
	}

	out := filepath.Join(repoPath, filepath.FromSlash(rel))
	st, err := os.Stat(out)
	if err != nil || !st.IsDir() {
		return "", fmt.Errorf("detected build output does not exist: %s", rel)
	}

	return out, nil
}
