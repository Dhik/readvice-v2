// HTML → PDF via Playwright (Chromium). Reuses a single browser instance across
// requests (cached on globalThis, like lib/prisma.js) so we don't relaunch
// Chromium per export. Node runtime only.
import { chromium } from 'playwright'
import { promises as fs } from 'fs'
import path from 'path'

const globalForPdf = globalThis

async function getBrowser() {
  if (!globalForPdf.__pdfBrowser || !globalForPdf.__pdfBrowser.isConnected?.()) {
    globalForPdf.__pdfBrowser = await chromium.launch({ headless: true })
  }
  return globalForPdf.__pdfBrowser
}

// Render an HTML string to a PDF Buffer. The template's CSS @page rules drive
// page size/margins (preferCSSPageSize), so each template controls its own layout.
export async function renderHtmlToPdf(html, opts = {}) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'load' })
    return await page.pdf({
      printBackground:   true,
      preferCSSPageSize: true,
      format:            opts.format ?? 'A4',
      ...(opts.margin ? { margin: opts.margin } : {}),
    })
  } finally {
    await page.close()
  }
}

// Resolve an image (public-relative path, absolute path, or http(s) URL) to a
// base64 data URI so it can be embedded directly in the HTML — no file/network
// fetch happens during PDF render. Returns null on any failure (templates show a
// graceful fallback).
export async function imgDataUri(src) {
  if (!src) return null
  try {
    let buf
    let mime = 'image/png'
    if (/^https?:\/\//i.test(src)) {
      const res = await fetch(src)
      if (!res.ok) return null
      buf = Buffer.from(await res.arrayBuffer())
      mime = res.headers.get('content-type') || mime
    } else {
      const rel = src.replace(/^\/+/, '')
      const abs = path.isAbsolute(src) ? src : path.join(process.cwd(), 'public', rel)
      buf = await fs.readFile(abs)
      if (/\.jpe?g$/i.test(abs)) mime = 'image/jpeg'
      else if (/\.webp$/i.test(abs)) mime = 'image/webp'
    }
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}
