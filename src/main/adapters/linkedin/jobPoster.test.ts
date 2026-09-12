import { describe, it, expect } from 'vitest'
import { parseJobPosterBlock } from './jobPoster'

// Trimmed from a real "Meet the hiring team" block's innerText, captured
// live this session on the Zetheta Algorithms posting.
const FIXTURE = `Meet the hiring team
Sangita Sanghvi
· 3rd
Co-Founder @ Zetheta Algorithms Private Limited
Job poster
Message`

describe('parseJobPosterBlock', () => {
  it('extracts the poster name and title, skipping the connection-degree line', () => {
    expect(parseJobPosterBlock(FIXTURE)).toEqual({
      name: 'Sangita Sanghvi',
      title: 'Co-Founder @ Zetheta Algorithms Private Limited'
    })
  })

  it('skips a connection-degree line using a bullet ("•") instead of a middle dot', () => {
    // Live-verified this session: the exact bullet character rendered
    // before the degree varied between captures of the same kind of block.
    const text =
      'Meet the hiring team\nSangita Sanghvi\n• 3rd\nCo-Founder @ Zetheta Algorithms Private Limited\nJob poster\nMessage'
    expect(parseJobPosterBlock(text)).toEqual({
      name: 'Sangita Sanghvi',
      title: 'Co-Founder @ Zetheta Algorithms Private Limited'
    })
  })

  it('handles a block with no connection-degree line', () => {
    const text = 'Meet the hiring team\nJane Doe\nRecruiter @ Acme\nJob poster\nMessage'
    expect(parseJobPosterBlock(text)).toEqual({ name: 'Jane Doe', title: 'Recruiter @ Acme' })
  })

  it('returns nulls when the heading is absent', () => {
    expect(parseJobPosterBlock('About the job\n\nSome JD text.')).toEqual({
      name: null,
      title: null
    })
  })

  it('returns a name with a null title when only one line follows the heading', () => {
    const text = 'Meet the hiring team\nJane Doe\nJob poster'
    expect(parseJobPosterBlock(text)).toEqual({ name: 'Jane Doe', title: null })
  })
})
