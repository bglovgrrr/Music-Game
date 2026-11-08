import { describe, expect, it } from 'vitest'
import { ALL_PROMPTS, dealQuestions, THEMES } from './prompts'

describe('question categories', () => {
  it('has four categories, each with light, warm and deep questions and no repeats', () => {
    expect(THEMES).toHaveLength(4)
    for (const t of THEMES) expect(new Set(t.questions.map((q) => q.depth))).toEqual(new Set([1, 2, 3]))
    const texts = ALL_PROMPTS.map((p) => p.prompt)
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('deals one light, one warm and one deep (plus one more), ordered light to deep', () => {
    for (let seed = 0; seed < 20; seed++) {
      const hand = dealQuestions(THEMES[seed % 4], new Set())
      expect(hand).toHaveLength(4)
      expect(new Set(hand.map((q) => q.depth))).toEqual(new Set([1, 2, 3]))
      expect(hand.map((q) => q.depth)).toEqual([...hand.map((q) => q.depth)].sort())
      expect(new Set(hand.map((q) => q.text)).size).toBe(4)
    }
  })

  it('skips questions already asked this game', () => {
    const t = THEMES[0]
    const used = new Set(t.questions.slice(0, 4).map((q) => q.text))
    const hand = dealQuestions(t, used)
    expect(hand.some((q) => used.has(q.text))).toBe(false)
  })
})
