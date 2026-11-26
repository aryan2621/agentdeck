import { describe, expect, it } from 'vitest'
import { CITIES, pickCity } from './cities'

describe('pickCity', () => {
  it('avoids live names and prefers unvisited', () => {
    expect(new Set(CITIES).size).toBe(CITIES.length)
    const c = pickCity(['Rome'], CITIES.filter((x) => x !== 'Oslo' && x !== 'Rome'))
    expect(c).toBe('Oslo')
  })
  it('falls back to a visited city, then a numbered one', () => {
    expect(pickCity(CITIES.slice(1), CITIES)).toBe(CITIES[0])
    expect(pickCity(CITIES, CITIES)).toBe(`${CITIES[0]} 2`)
  })
})
