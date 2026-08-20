declare global {
  interface Window {
    Tesseract?: {
      createWorker: (languages: string, oem?: number, options?: { logger?: (message: { status: string; progress: number }) => void }) => Promise<{
        recognize: (image: File | Blob) => Promise<{ data: { text: string } }>
        setParameters: (params: Record<string, string>) => Promise<void>
        terminate: () => Promise<void>
      }>
    }
  }
}

export {}
