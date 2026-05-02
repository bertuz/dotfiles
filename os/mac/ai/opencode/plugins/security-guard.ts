import type { Plugin } from "@opencode-ai/plugin"
import { existsSync, readFileSync, statSync } from "node:fs"
import { basename, isAbsolute, resolve } from "node:path"

const BLOCKED_ENV_COMMANDS = ["export", "env", "printenv", "set"]

const PRIVATE_KEY_FILENAME_PATTERNS: RegExp[] = [
  /^id_(rsa|dsa|ecdsa|ed25519|ed448|xmss)$/i,
  /.*_(rsa|dsa|ecdsa|ed25519)$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p8$/i,
  /\.pkcs8$/i,
  /\.pkcs12$/i,
  /\.pfx$/i,
  /\.p12$/i,
  /\.jks$/i,
  /\.keystore$/i,
]

const SAFE_SSH_FILENAMES = new Set([
  "config",
  "known_hosts",
  "known_hosts.old",
  "authorized_keys",
])

const PRIVATE_KEY_HEADER_RE = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/

const isInsideSshDir = (path: string): boolean => /(?:^|\/)\.ssh\//.test(path)

const isPublicKeyFile = (name: string): boolean => name.toLowerCase().endsWith(".pub")

const filenameLooksLikePrivateKey = (name: string): boolean => {
  if (isPublicKeyFile(name)) return false
  return PRIVATE_KEY_FILENAME_PATTERNS.some((re) => re.test(name))
}

const sniffFileLooksLikePrivateKey = (path: string): boolean => {
  try {
    const stat = statSync(path)
    if (!stat.isFile()) return false
    if (stat.size === 0) return false

    const buf = Buffer.alloc(Math.min(stat.size, 512))
    const fd = require("node:fs").openSync(path, "r")
    try {
      require("node:fs").readSync(fd, buf, 0, buf.length, 0)
    } finally {
      require("node:fs").closeSync(fd)
    }
    const head = buf.toString("utf8")
    return PRIVATE_KEY_HEADER_RE.test(head)
  } catch {
    return false
  }
}

const classifyPath = (
  path: string,
  cwd: string,
): { blocked: boolean; reason?: string } => {
  if (!path) return { blocked: false }

  const absolute = isAbsolute(path) ? path : resolve(cwd, path)
  const name = basename(absolute)

  if (isPublicKeyFile(name)) return { blocked: false }

  if (isInsideSshDir(absolute) && !SAFE_SSH_FILENAMES.has(name)) {
    return { blocked: true, reason: `path inside .ssh directory: ${absolute}` }
  }

  if (filenameLooksLikePrivateKey(name)) {
    return {
      blocked: true,
      reason: `filename matches private-key pattern: ${absolute}`,
    }
  }

  if (existsSync(absolute) && sniffFileLooksLikePrivateKey(absolute)) {
    return {
      blocked: true,
      reason: `file content begins with a PRIVATE KEY header: ${absolute}`,
    }
  }

  return { blocked: false }
}

const isEnvCommandBlocked = (
  command: string,
): { blocked: boolean; match?: string } => {
  const segments = command.split(/[;&|]+|\n|&&|\|\|/)

  for (const segment of segments) {
    const trimmed = segment.trim()
    if (!trimmed) continue
    const tokens = trimmed.split(/\s+/)
    const firstToken = tokens[0]

    if (firstToken === "export") return { blocked: true, match: "export" }
    if (firstToken === "printenv") return { blocked: true, match: "printenv" }
    if (firstToken === "env" && tokens.length === 1) return { blocked: true, match: "env" }
    if (firstToken === "set" && tokens.length === 1) return { blocked: true, match: "set" }
  }

  return { blocked: false }
}

const extractPathLikeTokens = (command: string): string[] => {
  const tokens = command
    .split(/[\s;&|"'`<>()]+/)
    .map((t) => t.replace(/^[=]+/, ""))
    .filter(Boolean)

  return tokens.filter((t) => {
    if (t.startsWith("-")) return false
    if (t.includes("/") || t.startsWith("~") || t.startsWith(".")) return true
    return PRIVATE_KEY_FILENAME_PATTERNS.some((re) => re.test(t))
  })
}

const expandHome = (path: string): string => {
  if (path === "~") return process.env.HOME ?? path
  if (path.startsWith("~/")) return `${process.env.HOME ?? ""}/${path.slice(2)}`
  return path
}

const isBashCommandBlocked = (
  command: string,
  cwd: string,
): { blocked: boolean; reason?: string } => {
  const envCheck = isEnvCommandBlocked(command)
  if (envCheck.blocked) {
    return {
      blocked: true,
      reason: `'${envCheck.match}' command is not allowed (would leak environment variables)`,
    }
  }

  const tokens = extractPathLikeTokens(command)
  for (const rawToken of tokens) {
    const token = expandHome(rawToken)
    const result = classifyPath(token, cwd)
    if (result.blocked) {
      return {
        blocked: true,
        reason: `command references a private key (${result.reason})`,
      }
    }
  }

  return { blocked: false }
}

export const SecurityGuardPlugin: Plugin = async ({ directory }) => {
  const cwd = directory

  return {
    "tool.execute.before": async (input, output) => {
      const args = output.args ?? {}

      if (input.tool === "bash") {
        const command: string = args.command ?? ""
        const result = isBashCommandBlocked(command, cwd)
        if (result.blocked) {
          throw new Error(
            `Blocked by security-guard plugin: ${result.reason}. Command: ${command}`,
          )
        }
        return
      }

      if (input.tool === "read" || input.tool === "edit" || input.tool === "write") {
        const filePath: string = args.filePath ?? ""
        const result = classifyPath(filePath, cwd)
        if (result.blocked) {
          throw new Error(
            `Blocked by security-guard plugin: ${result.reason}`,
          )
        }
        return
      }

      if (input.tool === "apply_patch") {
        const patchText: string = args.patchText ?? ""
        const markerRe = /^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm
        let match: RegExpExecArray | null
        while ((match = markerRe.exec(patchText)) !== null) {
          const filePath = match[1].trim()
          const result = classifyPath(filePath, cwd)
          if (result.blocked) {
            throw new Error(
              `Blocked by security-guard plugin: ${result.reason}`,
            )
          }
        }
        return
      }
    },
  }
}
