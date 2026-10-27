import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DATA_DIR = path.resolve(process.cwd(), 'data')

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, file), 'utf8')) as T
  } catch {
    return fallback
  }
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  const target = path.join(DATA_DIR, file)
  const temp = `${target}.tmp`
  await writeFile(temp, JSON.stringify(value, null, 2))
  await rename(temp, target)
}
