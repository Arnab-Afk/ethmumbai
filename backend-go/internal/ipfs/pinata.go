package ipfs

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type PinataClient struct {
	jwt     string
	client  *http.Client
	timeout time.Duration
}

type UploadResult struct {
	CID       string `json:"cid"`
	FileCount int    `json:"fileCount"`
}

func NewPinataClient(jwt string, timeout time.Duration) *PinataClient {
	return &PinataClient{
		jwt:     jwt,
		client:  &http.Client{Timeout: timeout},
		timeout: timeout,
	}
}

func (p *PinataClient) UploadDirectory(ctx context.Context, dirPath, name string) (UploadResult, error) {
	files, err := collectFiles(dirPath)
	if err != nil {
		return UploadResult{}, err
	}
	if len(files) == 0 {
		return UploadResult{}, fmt.Errorf("no files found to upload")
	}

	pr, pw := io.Pipe()
	mw := multipart.NewWriter(pw)

	go func() {
		defer pw.Close()
		defer mw.Close()

		for _, file := range files {
			if err := addFilePart(mw, file.absolute, file.relative); err != nil {
				_ = pw.CloseWithError(err)
				return
			}
		}

		if err := mw.WriteField("name", name); err != nil {
			_ = pw.CloseWithError(err)
			return
		}
	}()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://uploads.pinata.cloud/v3/files", pr)
	if err != nil {
		return UploadResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+p.jwt)
	req.Header.Set("Content-Type", mw.FormDataContentType())

	resp, err := p.client.Do(req)
	if err != nil {
		return UploadResult{}, fmt.Errorf("pinata upload failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return UploadResult{}, fmt.Errorf("pinata upload failed: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var parsed struct {
		Data struct {
			CID string `json:"cid"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return UploadResult{}, fmt.Errorf("failed to parse pinata response: %w", err)
	}
	if parsed.Data.CID == "" {
		return UploadResult{}, fmt.Errorf("pinata response missing CID")
	}

	return UploadResult{CID: parsed.Data.CID, FileCount: len(files)}, nil
}

type fileRef struct {
	absolute string
	relative string
}

func collectFiles(baseDir string) ([]fileRef, error) {
	var out []fileRef
	err := filepath.WalkDir(baseDir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if d.Name() == ".git" {
				return filepath.SkipDir
			}
			return nil
		}

		rel, relErr := filepath.Rel(baseDir, path)
		if relErr != nil {
			return relErr
		}

		out = append(out, fileRef{
			absolute: path,
			relative: filepath.ToSlash(rel),
		})
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("collect files: %w", err)
	}
	return out, nil
}

func addFilePart(mw *multipart.Writer, absolutePath, relativePath string) error {
	f, err := os.Open(absolutePath)
	if err != nil {
		return err
	}
	defer f.Close()

	part, err := mw.CreateFormFile("file", relativePath)
	if err != nil {
		return err
	}

	_, err = io.Copy(part, f)
	return err
}
