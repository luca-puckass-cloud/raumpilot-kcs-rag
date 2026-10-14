# First local model check · 14 October 2026

## Environment

RaumPilot local portal, Ollama on 127.0.0.1:11434. Installed model reported by Ollama: qwen3.8:27b, Q4_K_M, 27.3 billion parameters. The UI was switched from rule-based demo to the installed local model for this test. No external model endpoint was used.

## Question and authorised context

Demo user Lena, permitted request RFP-1042. Question: “Wie ist der aktuelle Status?”

The backend retrieved approved article KB-001 version 1.0 and separately read the permitted case data. Relevant facts: five hotels contacted, two responses received, zero customer-visible offers, no booking reference.

## Observed answer

“Deine Anfrage RFP-1042 wurde an 5 Hotels übermittelt. 2 Rückmeldungen liegen bereits vor, sind aber noch nicht zur Ansicht freigegeben. Du musst aktuell nichts bestätigen. Einen verbindlichen Zeitpunkt für die Hotelangebote kann ich dir nicht nennen.”

The chat displayed “Lokales Modell” and source KB-001 · v1.0. Its evidence section displayed the permitted request, stored update time, query time, keyword-search method and model name.

## Assessment

The answer preserved the important distinction between received and visible offers, did not confirm a booking and did not invent a delivery deadline. This one positive case proves that the local connector and knowledge/case-data flow can work. It is not a comprehensive accuracy or security evaluation.

## Remaining evaluation

Test booking-pending and confirmed cases, ambiguous questions, missing/retired sources, knowledge updates, model failures, irrelevant retrieval, prompt injection and multi-turn context. Measure answer quality and latency on a fixed test set before claiming reliable autonomous support.

## Semantic retrieval and editorial check

The next implementation uses local qwen3-embedding:0.6b embeddings and revision-bound article chunks. A 12-question development calibration run produced 10/12 correct top-1 retrieval results. Explicit domain intent among retrieved sources corrected two cross-topic rankings, yielding 12/12 expected final source selections or abstentions. This is neither an independent benchmark nor an evaluation of generated answers. The actual results, including both top-1 failures, are retained in evidence/retrieval-evaluation.json.

In the browser, Lena asked “Kann ich eine Rechnung rückwirkend aufteilen?”. Before approved knowledge existed, the chat abstained and created GAP-1001. Robin created a fictional billing article KB-004, sent it for review, added a review note and approved it. The draft was absent from the customer knowledge view before approval. The refreshed index contained four approved articles.

After switching back to Lena and the local qwen3.8:27b model, the same question produced: “Leider nein. Eine bereits ausgestellte Rechnung kann in der RaumPilot-Demo nicht nachträglich aufgeteilt werden. Änderungen an den Rechnungsempfängern müssen vor der Ausstellung mit dem Support abgestimmt werden.” The answer continued by offering a support ticket for a concrete check; no ticket was created by the model. The UI cited KB-004 version 1.0 and displayed local-model mode. Helpful feedback was recorded.

This demonstrates local source updates without model retraining. It does not establish production reliability or real invoice-processing capability.

## Paraphrased status and access boundary

With RFP-1042 selected, “Haben die angeschriebenen Häuser schon reagiert?” produced a local-model response citing KB-001: “Ja, es liegen bereits 2 Rückmeldungen von den 5 angeschriebenen Häusern vor. Diese werden derzeit geprüft, sodass noch keine kundensichtbaren Angebote verfügbar sind.” The counts and visibility distinction match the permitted fixture.

As Lena, “Ist RFP-2042 bereits gebucht?” returned a policy refusal with no source or booking details. The automated boundary tests separately check that forbidden case data never reaches the model. Both checks remain narrow examples, not a comprehensive adversarial evaluation.
