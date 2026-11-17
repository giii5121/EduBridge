# Quiz mascot variants

Created with the **built-in image_gen tool**, using the existing EduBridge astronaut as identity and style references. Original illustrations are unchanged. These PNGs have transparent backgrounds and were copied into the project without image postprocessing.

| File                 | Role in the application                                  |
| -------------------- | -------------------------------------------------------- |
| `quiz-ready.png`     | Welcoming coach on the assessment preparation screen     |
| `quiz-thinking.png`  | Neutral, supportive companion while answering questions  |
| `quiz-celebrate.png` | Celebrates completing an assessment, regardless of score |

References: `client/src/assets/images/mascots copy/wave.png` and `client/src/assets/images/mascots copy/mascot-2-1-2.png`.

Each image was generated in a separate call with `transparent_background: true` and both reference paths. The prompt for each call consisted of the exact shared prefix below followed by its variant suffix.

## Shared prompt prefix

```text
Use case: identity-preserve. Asset type: transparent PNG character sticker for an Indonesian mathematics learning app called EduBridge. The two attached images are identity and illustration-style references for the SAME existing character. Create ONE new full-body pose of exactly this friendly cyan round-faced astronaut: glossy pale-aqua spherical face inside a white and vivid-blue astronaut helmet with blue side headphones and small blue top fin, tiny navy oval eyes, pink blush cheeks, small friendly smile, compact white/blue spacesuit with tiny blue/yellow Saturn badge, short rounded limbs. Preserve character identity, recognizable proportions, rich crisp outlined 2D sticker style, blue-and-white palette, and soft cel-shaded highlights. Make all contours clean and production quality. Center isolated character with generous padding; genuinely transparent background. NO text, letters, numbers, speech bubble, ground scene, watermark, or other character.
```

## Ready suffix

```text
Pose: welcoming quiz coach, standing with one hand confidently holding a small blue clipboard against its body and the other hand giving a thumbs up. Both feet visible. Cheerful, encouraging, ready to begin. One small golden star beside its head, no other floating objects.
```

## Thinking suffix

```text
Pose: thoughtful quiz companion, seated comfortably with one gloved hand lightly on its chin and the other holding a small yellow pencil, looking attentively toward the left. A gentle curious smile, never worried or disappointed. Both boots visible. One very small golden sparkle near the helmet.
```

## Celebrate suffix

```text
Pose: celebrating learning effort, making a small joyful jump with both hands up, big happy closed crescent eyes, open smiling mouth and pink cheeks. Hold one small golden star-shaped award in one raised hand. Both feet visible, a few restrained golden sparkles. A warm encouraging celebration of finishing.
```

Companion messages are based on completion progress, not correctness. They do not expose assessment answers, award extra points, remove lives, or penalize mistakes. Existing XP and badge rules remain authoritative on the backend.
