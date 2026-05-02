import type { Character } from './supabase'

export async function generateLyrics(
  rhythm: Character,
  melody: Character,
  vocals: Character
): Promise<string> {
  const vp = vocals.game_params as any
  const mp = melody.game_params as any

  const theme = vp.lyric_theme || 'freedom'
  const emotion = (vp.emotion_keywords || ['passion']).join(', ')
  const vocalStyle = vp.vocal_style || 'sung'
  const mood = (mp.mood_keywords || ['powerful']).join(', ')
  const genre = [rhythm.genre, melody.genre, vocals.genre]
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ')
  const language = vp.language || 'en'

  const langInstruction = language !== 'en'
    ? `Write in ${language} language.`
    : 'Write in English.'

  const prompt = `Write song lyrics for a ${genre} song.

Theme: ${theme}
Emotional tone: ${emotion}
Mood: ${mood}
Vocal style: ${vocalStyle}
${langInstruction}

Format with [Verse 1], [Chorus], [Verse 2], [Chorus], [Outro] sections.
Keep it 20-30 lines total. Make it raw, authentic, and fitting the genre.
Return ONLY the lyrics, no explanations.`

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
    }),
  })

  if (!response.ok) {
    throw new Error(`Lyrics generation failed: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content.trim()
}
