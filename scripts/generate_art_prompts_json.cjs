#!/usr/bin/env node
// Parses art_prompts.md and generates public/art_prompts.json
const fs = require('fs')
const path = require('path')

const mdPath = path.join(__dirname, '..', 'art_prompts.md')
const outPath = path.join(__dirname, '..', 'public', 'art_prompts.json')

const content = fs.readFileSync(mdPath, 'utf8')

const NEGATIVE_PROMPT = "bad anatomy, bad hands, missing fingers, extra digits, fewer digits, cropped, worst quality, low quality, jpeg artifacts, signature, watermark, blurry, text, error, missing limb, floating limbs, disconnected limbs, malformed hands, long neck, mutated, ugly, deformed, (nsfw:1.3), realistic, photo, photography, 3d render"

const results = []

// Match each character block:
// **id** — Name\n```\nprompt\n```
const blockRegex = /\*\*([a-z0-9_]+)\*\*\s*—\s*[^\n]+\n```\n([\s\S]*?)\n```/g

// Track current archetype from section headers
let currentArchetype = ''
const archetypeRegex = /^####\s+(.+?)\s+\(`[^`]+`\)/m

// Process line by line to track archetype context
const lines = content.split('\n')
let inCodeBlock = false
let currentId = ''
let currentPromptLines = []
const archetypeMap = {}

// First pass: map each character id to its archetype
let lastArchetype = ''
for (const line of lines) {
  const arcMatch = line.match(/^####\s+(.+?)\s+\(/)
  if (arcMatch) {
    lastArchetype = arcMatch[1].trim()
  }
  const idMatch = line.match(/^\*\*([a-z0-9_]+)\*\*\s*—/)
  if (idMatch) {
    archetypeMap[idMatch[1]] = lastArchetype
  }
}

// Second pass: extract prompts
let match
while ((match = blockRegex.exec(content)) !== null) {
  const id = match[1]
  const positive_prompt = match[2].trim()
  results.push({
    id,
    positive_prompt,
    negative_prompt: NEGATIVE_PROMPT,
    archetype: archetypeMap[id] || ''
  })
}

fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8')
console.log(`Generated ${results.length} prompts → ${outPath}`)
