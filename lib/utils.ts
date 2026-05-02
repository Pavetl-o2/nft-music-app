import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatGenre(genre: string) {
  return genre.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + '...' : str
}
