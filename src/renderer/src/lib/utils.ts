import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...i: ClassValue[]): string => twMerge(clsx(i))

/** Settings > "I'm not absolutely right": drops the stock "You're absolutely right!" opener. */
export const stripAbsolutelyRight = (text: string): string => text.replace(/^\s*You(?:'|\u2019)re absolutely right[!.]?\s*/i, '')
