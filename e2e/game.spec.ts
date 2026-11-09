import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { expect, test, type Page } from '@playwright/test'

const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')

/** Live search is blocked so the built-in song list answers: same results every run. */
async function offlineSearch(page: Page) {
  await page.route('**/api/spotify-search**', (r) => r.abort())
  await page.route('https://itunes.apple.com/**', (r) => r.abort())
}

/** The screen fits the phone: nothing to scroll. */
async function expectNoScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const main = document.querySelector('main')
    return Math.max(document.documentElement.scrollHeight - innerHeight, main ? main.scrollHeight - main.clientHeight : 0)
  })
  expect(overflow, 'screen should fit without scrolling').toBeLessThanOrEqual(2)
}

async function expectAccessible(page: Page) {
  await page.addScriptTag({ content: AXE })
  const violations = await page.evaluate(async () => {
    const w = window as unknown as { axe: { run: (d: Document, o: object) => Promise<{ violations: { id: string; nodes: unknown[] }[] }> } }
    const r = await w.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'best-practice'] })
    return r.violations.map((v) => `${v.id} (${v.nodes.length})`)
  })
  expect(violations, 'accessibility violations').toEqual([])
}

async function check(page: Page) {
  await page.waitForTimeout(500) // let entrance animations settle
  await expectNoScroll(page)
  await expectAccessible(page)
}

test('a full demo game: lobby → question → pick → listen → vote → recap', async ({ page }) => {
  await offlineSearch(page)
  await page.goto('/')
  await expect(page.getByText(/v\d+\.\d+\.\d+ · /)).toBeVisible() // version stamp
  await check(page)

  await page.getByLabel('Your name').fill('Brian')
  await page.getByRole('button', { name: /try a demo/i }).click()
  await expect(page.getByRole('heading', { name: 'Who’s here' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Start with 4 players/ })).toBeEnabled({ timeout: 15_000 })
  await check(page)

  await page.getByRole('button', { name: /Start with 4 players/ }).click()
  await expect(page.getByRole('tab', { name: 'Basement Sessions' })).toBeVisible()
  await check(page)
  await page.getByRole('tab', { name: 'Slow Dance' }).click()
  await page.locator('li button').first().click()

  const search = page.getByPlaceholder('Search songs or artists')
  await expect(search).toBeFocused() // ready to type straight away
  await search.fill('queen')
  await page.getByRole('button', { name: /Dancing Queen/ }).click()
  await page.getByRole('button', { name: /Lock it in/ }).click()

  await expect(page.getByRole('slider', { name: 'Tape position' })).toBeVisible({ timeout: 20_000 })
  await check(page)

  // React, then skip through every song
  await page.getByRole('button', { name: 'React 🔥' }).click()
  for (let i = 0; i < 6 && !(await page.getByRole('heading', { name: 'Song of the round' }).count()); i++) {
    await page
      .getByRole('button', { name: /^Next song$|^Finish round$/ })
      .first()
      .click()
    await page.waitForTimeout(400)
  }
  await expect(page.getByRole('heading', { name: 'Song of the round' })).toBeVisible()
  await check(page)

  await page.locator('main li button:enabled').first().click() // vote
  await page.getByRole('button', { name: /Selfie & scores: show/ }).click()
  await page.getByRole('button', { name: /End game/ }).click()
  await expect(page.getByText('wrap.')).toBeVisible()
  await check(page)

  await page.getByRole('button', { name: /Share recap card/ }).click()
  await expect(page.getByRole('img', { name: /Recap card/ })).toBeVisible({ timeout: 20_000 })
})

test('going back keeps songs already heard uncovered', async ({ page }) => {
  await offlineSearch(page)
  await page.goto('/')
  await page.getByLabel('Your name').fill('Brian')
  await page.getByRole('button', { name: /try a demo/i }).click()
  await page.getByRole('button', { name: /Start with 4 players/ }).click({ timeout: 15_000 })
  await page.locator('li button').first().click()
  await page.getByPlaceholder('Search songs or artists').fill('africa')
  await page.getByRole('button', { name: /Africa/ }).click()
  await page.getByRole('button', { name: /Lock it in/ }).click()
  await expect(page.getByRole('slider', { name: 'Tape position' })).toBeVisible({ timeout: 20_000 })
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Next song' }).click()
    await page.waitForTimeout(300)
  }
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Previous song' }).click()
    await page.waitForTimeout(300)
  }
  await page.getByRole('button', { name: /This round's mixtape: show/ }).click()
  await expect(page.getByText('Mystery song')).toHaveCount(0)
})

test('the share link page explains a missing mixtape', async ({ page }) => {
  await page.route('**/rest/v1/rpc/get_share', (r) => r.fulfill({ json: null }))
  await page.goto('/?wrap=abcdefghij')
  await expect(page.getByText('This mixtape got lost')).toBeVisible()
  await page.getByRole('button', { name: /Start your own mixtape/ }).click()
  await expect(page.getByLabel('Your name')).toBeVisible()
})
