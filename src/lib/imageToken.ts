import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

function getKey(): Buffer {
  const hex = process.env.IMAGE_PROXY_SECRET
  if (!hex || hex.length !== 64) throw new Error('IMAGE_PROXY_SECRET must be a 64-char hex string')
  return Buffer.from(hex, 'hex')
}

export function encryptUrl(url: string, portfolioId: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const payload = JSON.stringify({ url, portfolioId })
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64url')
}

export function decryptUrl(token: string): { url: string; portfolioId: string } {
  const buf = Buffer.from(token, 'base64url')
  if (buf.length < 29) throw new Error('invalid token')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const encrypted = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(tag)
  const payload = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  return JSON.parse(payload) as { url: string; portfolioId: string }
}

export function applyTransform(url: string, tr: string): string {
  const uploadIdx = url.indexOf('/upload/')
  if (uploadIdx === -1) return url
  const afterUpload = url.slice(uploadIdx + 8)
  const versionMatch = afterUpload.match(/^(?:[^/]+\/)?(v\d+\/.+)$/)
  if (versionMatch) {
    return url.slice(0, uploadIdx + 8) + tr + '/' + versionMatch[1]
  }
  return url.slice(0, uploadIdx + 8) + tr + '/' + afterUpload
}
