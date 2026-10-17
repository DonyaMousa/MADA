# Matching and eligibility

Mada separates **hard eligibility** from **suitability ranking**. A suitability score is not an acceptance probability.

## Hard eligibility

Evaluated from explicit, source-backed scholarship rules:

- nationality / citizenship
- intended degree (Master’s or PhD)
- field of study, when the source names fields
- GPA **only when the scholarship scale matches the student’s reported scale**
- language tests named by the source
- required experience, when stated

Outcomes:

| Outcome | Meaning |
| --- | --- |
| Eligible | Every evaluated hard rule passed |
| Possibly eligible | No hard failure, but at least one rule could not be decided |
| Ineligible | At least one hard rule failed |
| Insufficient information | Required rules exist but the profile does not contain the facts needed to decide them |

GPA scales are never converted. Missing qualifications are never inferred.

A high suitability score cannot override a hard disqualification.

## Suitability (0–100)

Used only for scholarships that are eligible or uncertain (not ineligible).

Documented combination:

1. **Structured preferences (60%)** — overlap of destination, degree, field, funding need, and research-interest keywords with the listing.
2. **Text similarity (40%)** — cosine similarity of bag-of-tokens embeddings over the profile narrative (research interests + experience) and the scholarship’s verified requirement text.

The default embedding is a **pretrained-style hashed unigram/bigram vector** computed locally. It is not trained on student CVs, letters, or uploads. If `OPENAI_API_KEY` is configured on the API server, the server may replace the text component with a hosted pretrained embedding model. That path still never fine-tunes on private files.

## Evaluation set

Synthetic, reviewed profile–scholarship pairs live in `evaluation/matching-eval.json`. They use public requirement text from catalog examples, not real student documents.

Limitations:

- Catalog listings are development examples with official source URLs; deadlines may be unknown.
- Field matching is conservative and can mark “unknown” instead of guessing.
- Language tests are compared only when the same test name is present.
- Semantic similarity can surface topical overlap that is not eligibility.
