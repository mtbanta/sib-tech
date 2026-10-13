# Run 3 notes: Anthropic's terms and the pay-as-you-go API account

## Decisive facts

Research input for a human decision, not legal advice and not an instruction to trade. Each answer is built from quotes; the IDs point to the findings below.

| Question | Short answer from the texts | IDs |
| :---- | :---- | :---- |
| Q1. Who may open a Console (API) account, and under which terms? | The Commercial Terms are an agreement with "you or the organization, company, or other entity that you represent ("Customer")" and govern "Customer's use of Anthropic API keys". They also say "Services under these Terms are not for consumer use", without defining consumer use. The Consumer Terms send API key and Console use to the Commercial Terms. No page read says only businesses may sign up, and none says individuals may. | AN-13, AN-15, AN-26 |
| Q1. What signup and use require | Help articles: a phone number from a supported location that can receive texts (for a Claude account; not stated for the Console form), Google or emailed-link login, "some additional information about your organization and use case", payment details, then prepaid credits. Anthropic may ask "to verify Customer's identity"; a Persona photo ID check exists "for a few use cases". The United States is a supported region. | AN-13, AN-26, AN-29, AN-34 |
| Q1. Billing | Prepaid credits, available at once, non-refundable, expire after one year. Optional auto-reload. Monthly invoicing only through sales. API calls stop when credits run out. | AN-27, AN-19 |
| Q1. Tiers and deposits | No deposit thresholds: "There's no deposit or purchase that moves you up". Tiers Start, Build, Scale, Custom are assigned automatically. New organizations "may start in the Evaluation tier, with limits below the standard limits", numbers not published. | AN-22, AN-28 |
| Q1. Rate limit, lowest standard tier (Start) | Opus 5.5, Sonnet 5.5, Haiku 5.5: 1,000 requests, 2,000,000 input tokens and 400,000 output tokens per minute each. Fable 5.1: 1,000 / 500,000 / 100,000. A brand new account may be lower (Evaluation tier). | AN-23, AN-22 |
| Q1. Monthly spend cap (can stop an order path) | Start 500, Build 1,000, Scale 200,000 US dollars a month. At the cap the API returns HTTP 429 with no `retry-after` until 00:00 UTC on the 1st of next month. Arithmetic using run 2's ESTIMATE (DC-37, its assumptions): one run every 5 minutes is under 500 dollars for every model; one run every minute uncached would be over 500 for Opus 5.5 (900.90) and Fable 5.1 (2,252.25). | AN-22, DC-37 |
| Q1. Token prices per million tokens, input / output | Fable 5.1 10 / 50. Opus 5.5 4 / 20. Sonnet 5.5 2 / 10. Haiku 5.5 0.10 / 0.50 (up to 100,000 token prompts). Batch: half price, not instant. Cache hits: Opus 5.5 0.20, Sonnet 5.5 0.10, Haiku 5.5 0.01. Managed Agents adds 0.08 per session-hour while running. All published. | AN-20, AN-21 |
| Q1. Max 5x API credit | 100 US dollars a month (Max 20x: 200), claimed by linking ONE Console organization, after seven days on the plan, no card needed. Covers the Messages and Batches API, Console Playground, Managed Agents and the Agent SDK. Covers `claude -p` only "when you run them yourself with an API key from your linked Claude Console organization". Not interactive Claude Code, not extra usage, not Bedrock, Vertex or Foundry. No rollover; requests stop when it runs out unless purchased credits exist. | AN-18 |
| Q1. Which terms govern spending the credit | Not stated in one sentence anywhere. The article names only the "Supplemental Credit Terms", which attach to whatever agreement references them; the Commercial Terms reference them, the Consumer Terms do not mention credits, and the Consumer Terms say API key and Console use is under the Commercial Terms. Open question for Anthropic. | AN-19, AN-15 |
| Q1. Which terms govern Claude Code on Max | Claude Code legal page: Consumer Terms "for Free, Pro, and Max users"; Commercial Terms "for Team, Enterprise, and Claude API users". | AN-17 |
| Q1. Consumer Terms securities passage | STILL PRESENT, unchanged, effective October 8, 2025: "To rely upon the Services, the Materials, or the Actions to buy or sell securities or to provide or receive advice about securities, commodities, derivatives, or other financial products or services, as Anthropic is not a broker-dealer or a registered investment adviser under the securities laws of the United States or any other jurisdiction." | AN-15 |
| Q1. Finance or trading text in the Commercial Terms | None. 0 hits for securities, trading, invest, financial, broker, advice, recommendation, autonomous, qualified, personal, individual. The Usage Policy is incorporated by reference, so its high-risk rules apply to API use. | AN-14, AN-13 |
| Q1. Reliability | HTTP 529 "The API is temporarily overloaded" is documented. Standard tier is "best-effort availability". Priority Tier "no longer available for purchase". No uptime commitment in the Commercial Terms; "AS IS", no warranty that use "WILL BE UNINTERRUPTED"; liability capped at 12 months' fees. Status page lists up to seven incidents from Sep 29 to Oct 13, 2026. | AN-24, AN-13, AN-25 |
| Q2. Usage Policy in force today (Sep 15, 2025) | Finance is a high-risk use case ("financial decisions, including investment advice") in a section for "specific consumer-facing use cases". "a qualified professional in that field must review the content or decision prior to dissemination or finalization." "Qualified professional" is not defined. No exclusions list. | AN-03, AN-05 |
| Q2. Usage Policy effective Nov 12, 2026 | Covers "a personalized recommendation to buy, sell, hold, or allocate among specific investment products". "A qualified person must meaningfully review a High-risk AI Recommendation, with the authority to change or modify it, before it is delivered as advice to an individual who might rely on it or before it is used to implement a decision. A qualified person is someone with the training or experience to evaluate the output in that field, and who holds a license where applicable law requires one for the underlying activity." Six listed AI Recommendation exclusions, including internal research "not the ultimate" recommendation and "applying a fixed rule, formula, or algorithm where the model exercises no judgment about the individual". | AN-07, AN-08, AN-10 |
| Q2. "Qualified person" in the Commercial Terms | Does not appear. "qualified": 0 hits. "qualified professional": 0 hits. | AN-14 |
| Q2. Can the account owner be the qualified person? | The texts do not say. 0 hits in both Usage Policy versions, the Commercial Terms and Anthropic's October 8, 2026 news post for "account owner", "own account", "self-directed", "personal use" and "yourself". No text says whether the user, the "individual who might rely on it" and the "qualified person" can be one person. Anthropic's news post says the high-risk requirements "haven't changed" and does not address this. | AN-35, AN-31 |


Status line: COMPLETE as far as this session could take it. 37 findings (AN-01 to AN-37), a decisive-facts table, and the Not verified, Needs a browser, Only Anthropic can settle in writing, and Contradictions with run 2 lists. Weakest areas: the Evaluation tier's numbers (not published), the status page's uptime figures (drawn by scripts), and what the Console signup form asks for (not readable without signing in).

Topic: what it takes to open and use a commercial Anthropic account with pay-as-you-go API use, how that account enables or limits using Claude to identify and execute trades for the owner's own account, and how Anthropic's texts define the "qualified person" who must review personalized buy or sell recommendations.

Date of research: 2026-10-13 (America/Chicago), confirmed with `date` at the start of the session (Tue Oct 13 16:08 CDT 2026). Every finding below was accessed 2026-10-13 unless marked as reused.

This file is research input for a human decision. Nothing in it is a recommendation, a legal opinion, or an instruction to trade. It quotes Anthropic's texts. It does not interpret the law and does not predict how Anthropic would rule on any use.

## Method

- Anthropic pages were downloaded with `curl` (its default identification string, no personal information, no cookies, no sign-in) into a new empty scratch folder outside the repository, and the HTML was reduced to text with the Mac's built-in `python3 -I` using the standard library only. Documentation pages were read in their plain-text (`.md`) form. Quotes marked "verbatim (curl)" are the page's own words with tags stripped.
- Quotes marked "via fetch tool" came through the WebFetch tool, which passes a page through a summarizing model and may paraphrase.
- Quotation marks. Anthropic's pages use curly quotation marks and apostrophes. In every quote in this file they are shown as straight ones. Nothing else is changed.
- Quote check. Before the scratch files were deleted, every "verbatim (curl)" quote in this file was checked by a script as an exact substring of the downloaded text (after the quotation-mark and dash changes above and collapsing line breaks). 128 pieces checked; the only mismatches were two caused by the checker splitting on quotation marks inside a label (confirmed by hand) and two where lines of the page were joined (AN-01 page header, where the page prints "2026Previous Version" with no space; AN-24, where a warning box is joined to the line above). Table rows marked "spacing removed" were not machine-checked.
- Dash rule. Where a quoted Anthropic text contains a long dash (em dash or en dash), it is replaced in this file with " [dash] ". Nothing else in a quote is changed.
- Word searches were run with a small standard-library script over the stripped text of each document, limited to the document body (site menus and footers cut off where noted). A count of 0 is recorded as a non-hit. Absence in the text read is not a ruling.
- No browser was used (the Playwright server was down and other browser tools were ruled out). No sign-in, no signup flow, no account creation. Nothing installed.
- Strength scale: A = primary and authoritative (Anthropic's own pages seen live). B = reputable independent press or an established reference publisher. C = review sites, comparison sites, affiliate blogs. D = forums, social posts, personal blogs, community code repositories.

## Run 2 findings reused and reopened

Reopened today (re-read at the source, because run 3's questions turn on exact current wording or current numbers):

- DC-01 to DC-12 (both Usage Policy versions): reopened because Q2 needs the full high-risk section of each version quoted exactly, including parts run 2 did not record (the "Favorable Decisions" block, the disclosure rule, the physical actions exclusions) and a fuller word search. Result: AN-01 to AN-12.
- DC-14, DC-15 (Consumer Terms securities passage): reopened because the brief asks whether the passage is still present today. Result: AN-15, AN-16.
- DC-16 (Commercial Terms have no securities text): reopened for the full word list the brief names and for the definition of "Customer". Result: AN-13, AN-14.
- DC-34 (monthly API credit on Max): reopened because the brief asks what it covers, whether it covers `claude -p`, and which terms govern it. Result: AN-17 to AN-19.
- DC-35 (model prices), DC-32 (Managed Agents session-hour), DC-39 (Start tier rate limits): reopened so the numbers are today's. Result: AN-20 to AN-23. Prices and Start tier limits unchanged; new detail on spend caps and the Evaluation tier.
- DC-13 (agents help article), DC-17 (Software Directory Policy), DC-20 (Usage Policy update article): reopened to check for any change and for any text on self-directed use. Result: AN-31 to AN-34. DC-13 and DC-17 unchanged; DC-20 is corrected by AN-31.
- DC-33 and run 1's RT-14 (Max plan price and limits): reopened because the brief asks for today's price on Anthropic's own page. Result: AN-30. Unchanged.

Reused without reopening (cited only, kept at their 2026-10-09 date): DC-18 and DC-19 (broker connectors in Anthropic's marketplace), DC-21 to DC-31 (routines, desktop tasks, `/loop`, `claude -p`, Managed Agents scheduling), DC-33 (Max usage limits shape), DC-36 to DC-38 (cache timing and cost estimates). They are outside this helper's topic or were not needed to answer it. DC-37 (cost estimate) is cited once, as arithmetic, in the decisive-facts table.

## Findings register

### Part A: the Usage Policy, both versions (Q2, and Q1's word search)

**AN-01.** The Usage Policy page at Anthropic's main address today shows the version "Effective November 12, 2026" with a "Previous Version" link. The new version's opening says the policy applies to everyone who submits inputs, explicitly including "individuals using our apps (such as Claude.ai and Claude Code)" and "developers and businesses using our API".
Page: Usage Policy (Anthropic)
URL: https://www.anthropic.com/legal/aup
Accessed: 2026-10-13
Strength: A
Quote: "Usage Policy Effective November 12, 2026 Previous Version" and "Our Usage Policy (also referred to as our "Acceptable Use Policy" or "AUP") applies to anyone who submits inputs to Anthropic's products or services, all of whom we refer to as "users." This includes individuals using our apps (such as Claude.ai and Claude Code), developers and businesses using our API and developer platforms, customers accessing Claude through cloud providers and authorized resellers, and the end users of products or services integrating Claude." (verbatim (curl); the page uses curly quotation marks, shown here as straight ones)

**AN-02.** The version in force today, October 13, 2026, is the one behind the "Previous Version" link, effective September 15, 2025. Its banner describes the website ("replaced by a newer version"), while the newer version's own header gives November 12, 2026 as its effective date.
Page: Usage Policy (archived version)
URL: https://www.anthropic.com/legal/archive/22742366-2ef0-4c7a-a833-6523f10d3944
Accessed: 2026-10-13
Strength: A
Quote: "This document has been replaced by a newer version, and is available for archival purposes Effective September 15, 2025" (verbatim (curl))

**AN-03.** IN FORCE TODAY (September 15, 2025 version), high-risk section, in full as it bears on finance. Finance is a "High-Risk Use Case" described broadly ("financial decisions, including investment advice"). The overview says these requirements apply to "specific consumer-facing use cases". The review rule requires "a qualified professional in that field" to review "advice, recommendations, or ... subjective decision-making directly affecting individuals or consumers" before "dissemination or finalization". The disclosure rule applies "If model outputs are presented directly to individuals or consumers". The term "qualified professional" is NOT defined anywhere in this version (the word "qualified" appears once in the body). This version has no exclusions list.
Page: Usage Policy (archived version), section "High-Risk Use Case Requirements"
URL: https://www.anthropic.com/legal/archive/22742366-2ef0-4c7a-a833-6523f10d3944
Accessed: 2026-10-13
Strength: A
Quote (overview line): "High-Risk Use Case Requirements: Our High-Risk Use Case Requirements apply to specific consumer-facing use cases that pose an elevated risk of harm." (verbatim (curl))
Quote (section opening): "Some use cases pose an elevated risk of harm because they influence domains that are vital to public welfare and social equity. For these use cases, given potential risks to individuals and consumers, we believe that relevant human expertise should be integrated and that end-users should be aware when AI has been involved in producing outputs. As such, for the "High-Risk Use Cases" described below, we require that you implement these additional safety measures:" (verbatim (curl))
Quote (review rule): "Human-in-the-loop: When using our products or services to provide advice, recommendations, or in subjective decision-making directly affecting individuals or consumers, a qualified professional in that field must review the content or decision prior to dissemination or finalization. You or your organization are responsible for the accuracy and appropriateness of that information." (verbatim (curl))
Quote (disclosure rule): "Disclosure: If model outputs are presented directly to individuals or consumers, you must disclose to them that you are using AI to help produce your advice, decisions, or recommendations. This disclosure must be provided at a minimum at the beginning of each session." (verbatim (curl))
Quote (finance item): "Finance: Use cases related to financial decisions, including investment advice, loan approvals, and determining financial eligibility or creditworthiness" (verbatim (curl))

**AN-04.** IN FORCE TODAY (September 15, 2025 version), agents and chatbots. The agents paragraph is one sentence plus a pointer to a help article. The chatbot disclosure rule covers "consumer-facing chatbots, including any external-facing or interactive AI agent".
Page: Usage Policy (archived version), section "Additional Use Case Guidelines"
URL: https://www.anthropic.com/legal/archive/22742366-2ef0-4c7a-a833-6523f10d3944
Accessed: 2026-10-13
Strength: A
Quote: "Agentic use cases must still comply with the Usage Policy. We provide examples of Usage Policy prohibitions in the context of agentic use in this Help Center article." (verbatim (curl))
Quote: "The below use cases [dash] regardless of whether they are High-Risk Use Cases [dash] must comply with the additional guidance provided. All consumer-facing chatbots, including any external-facing or interactive AI agent, must disclose to users that they are interacting with AI rather than a human. This disclosure must be provided at a minimum at the beginning of each chat session." (verbatim (curl))

**AN-05.** IN FORCE TODAY (September 15, 2025 version), word search of the policy body (from "Our Usage Policy (also" to the start of the site footer menu, so menu links such as "Financial advisors" are excluded). Non-hits (0): "securities", "trading", "broker", "autonomous", "own account", "self-directed", "account owner", "yourself", "transaction", "market manipulation", "execut", "personal use", "your own". Hits: "qualified" 1 (the review rule, AN-03); "professional" 3 (the review rule, "professional certification exams", "professional journalistic content"); "invest" 1 (the finance item); "financ" 5 in the body (finance item, "financial markets" in the critical systems prohibition, "direct financial or psychological harm" in the fraud prohibition); "personal" 2 (privacy, and "personalized vote or campaign targeting"); "licens" 1 ("fake IDs, licenses"); "trade" 1 ("trade union", in a biometric categorization prohibition); "securit" 3 (all computer or election security); "individual" 15; "agent" 4; "advice" 5; "recommendation" 3; "fraud" 3. "market" 2 ("financial markets" in the critical systems prohibition, and "multi-level marketing"); "manipulat" 1 ("subliminal, manipulative, or deceptive techniques to distort behavior"). No text on manipulating securities markets was found under any wording searched.
Page: as AN-03
URL: https://www.anthropic.com/legal/archive/22742366-2ef0-4c7a-a833-6523f10d3944
Accessed: 2026-10-13
Strength: A (for absence in the text read)
Quote (the one other finance-market hit): "Obtain unauthorized access to critical systems such as voting machines, healthcare databases, and financial markets" (verbatim (curl))

**AN-06.** EFFECTIVE NOVEMBER 12, 2026 version, high-risk section opening. The overview no longer says "consumer-facing": it says the requirements "apply to specific use cases that pose an elevated risk of harm to individuals". The section says a qualified person must "remain accountable for what is delivered or decided" and that the requirements apply "to anyone who uses our products to make a High-risk AI Recommendation".
Page: Usage Policy, section "High-risk Use Case Requirements"
URL: https://www.anthropic.com/legal/aup
Accessed: 2026-10-13
Strength: A
Quote (overview line): "High-risk Use Case Requirements: Our High-risk Use Case Requirements apply to specific use cases that pose an elevated risk of harm to individuals." (verbatim (curl))
Quote (section opening): "Certain uses of our products and services can impact an individual's health, legal rights, finances, livelihoods, or access to housing, education, or essential services. When our products are used for these high-risk use cases, we require that a qualified person remain accountable for what is delivered or decided, and that the impacted individual knows AI was involved in the advice or decision. These requirements apply to anyone who uses our products to make a High-risk AI Recommendation or control equipment capable of High-risk Physical Actions. These requirements for high-risk use cases are meant to protect individuals. However, they do not replace local legal requirements and restrictions. Users should always default to following local laws if those laws conflict with or add additional requirements to the requirements listed below. Our products and services may not be suitable for all use cases." (verbatim (curl))

**AN-07.** EFFECTIVE NOVEMBER 12, 2026 version, what a "High-risk AI Recommendation" is. The page has no sentence of the form "High-risk AI Recommendation means ...". The nearest thing to a definition is the sentence that introduces the list of "High-risk Areas": the requirements apply when users "provide a recommendation" in a listed area. The only terms the page puts in quotation marks as defined terms in this part are "High-risk Areas" and "wholly favorable." (a check of every quoted phrase on the page). The finance item covers a "personalized recommendation to buy, sell, hold, or allocate among specific investment products, such as securities, funds, digital assets, or annuities".
Page: Usage Policy, section "High-risk AI Recommendations"
URL: https://www.anthropic.com/legal/aup
Accessed: 2026-10-13
Strength: A
Quote (introducing sentence): "The requirements apply when users use our products or services to provide a recommendation in any of the following, which are "High-risk Areas":" (verbatim (curl))
Quote (finance item): "Finance [dash] a personalized recommendation to buy, sell, hold, or allocate among specific investment products, such as securities, funds, digital assets, or annuities; advising an individual on their own taxes, such as what to report, deduct, or claim; or preparing a tax return for them to sign or file." (verbatim (curl))
Also on the page, the neighbouring credit item (for completeness, because a margin loan might be read against it; no interpretation offered): "Credit [dash] approving, denying, or setting the amount, rate, or limit of a loan, mortgage, credit line, or similar product, or reducing or closing an existing one, or producing a credit score or creditworthiness assessment used for such decisions." (verbatim (curl))

**AN-08.** EFFECTIVE NOVEMBER 12, 2026 version, the review requirement and the definition of "qualified person", exactly. Review must be "meaningful", by someone "with the authority to change or modify it", and must happen before the recommendation "is delivered as advice to an individual who might rely on it or before it is used to implement a decision". A qualified person is "someone with the training or experience to evaluate the output in that field, and who holds a license where applicable law requires one for the underlying activity". The qualified person "remains responsible" for what is delivered or decided. The words "qualified professional" do not appear in this version (0 hits); it uses "qualified person" (and "qualified individual" once, for physical actions).
Page: Usage Policy, section "Requirements"
URL: https://www.anthropic.com/legal/aup
Accessed: 2026-10-13
Strength: A
Quote: "For High-risk AI Recommendations or Physical Actions, users must implement the following controls: Qualified human-in-the-loop for advice and decisions [dash] A qualified person must meaningfully review a High-risk AI Recommendation, with the authority to change or modify it, before it is delivered as advice to an individual who might rely on it or before it is used to implement a decision. A qualified person is someone with the training or experience to evaluate the output in that field, and who holds a license where applicable law requires one for the underlying activity. The qualified person remains responsible for the accuracy and appropriateness of what is delivered or decided." (verbatim (curl))

**AN-09.** EFFECTIVE NOVEMBER 12, 2026 version, the disclosure requirement. It applies to "An individual who receives advice or who is the subject of a decision based on a High-risk AI Recommendation".
Page: Usage Policy, section "Requirements"
URL: https://www.anthropic.com/legal/aup
Accessed: 2026-10-13
Strength: A
Quote: "Disclosure for advice and decisions [dash] An individual who receives advice or who is the subject of a decision based on a High-risk AI Recommendation must be clearly told that AI was used to produce it. Users do not need to identify Anthropic, Claude, or the model used." (verbatim (curl))

**AN-10.** EFFECTIVE NOVEMBER 12, 2026 version, every listed exclusion. Under "Exclusions" the page has three groups. "AI Recommendations": six examples, introduced as "non-exhaustive". "Physical Actions": four. "Favorable Decisions": four, introduced "Where permitted by law" (run 2 did not record this group; none of its four is about investments). The two AI Recommendation exclusions most often cited in this project are "Internal drafting, research, summarization, or analysis that is not the ultimate High-risk AI Recommendation delivered" and "Carrying out a decision a person has already made, or applying a fixed rule, formula, or algorithm where the model exercises no judgment about the individual".
Page: Usage Policy, section "Exclusions"
URL: https://www.anthropic.com/legal/aup
Accessed: 2026-10-13
Strength: A
Quote (AI Recommendations group, in full): "The requirements do not apply to: AI Recommendations Using our products to assist in workflows that are related to, but do not actually provide, High-risk AI Recommendations. Some non-exhaustive examples are: General information or educational content, including explaining what a law says, how a condition or treatment works, or how investing works, without applying it to the individual's circumstances. Wellness content, such as education on sleep, stress, nutrition, or exercise. Explaining or helping an individual understand advice, a diagnosis, or a decision that a qualified person has already given them (as long as it is not an additional High-risk AI Recommendation). Internal drafting, research, summarization, or analysis that is not the ultimate High-risk AI Recommendation delivered. Carrying out a decision a person has already made, or applying a fixed rule, formula, or algorithm where the model exercises no judgment about the individual. Business operations that do not advise or decide about a specific individual." (verbatim (curl))
Quote (Physical Actions group): "Consumer and household devices operating within the manufacturer's built-in safety limits, where the worst possible outcome is discomfort or inconvenience. Generating plans, code, toolpaths, waypoints, or commands that a qualified person reviews before they are executed on equipment. Monitoring, sensing, or reporting on equipment without controlling it. Laboratory automation handling non-hazardous materials inside enclosed instruments." (verbatim (curl))
Quote (Favorable Decisions group): "Where permitted by law, human-in-the-loop review is not required before acting on a High-risk AI Recommendation wholly favorable to the individual in the following circumstances: Paying an insurance claim. Approving coverage or prior authorization for care a clinician has ordered. Granting eligibility for a healthcare service or program. Granting or continuing a public benefit or service. Additional legal obligations such as disclosure may still apply. A partial approval, reduced amount, or approval with conditions is not considered "wholly favorable."" (verbatim (curl))

**AN-11.** EFFECTIVE NOVEMBER 12, 2026 version, the agents paragraph and the chatbot disclosure rule. Users are responsible for agents "they build or deploy, including actions those agents take through tools, browsers, or connected systems". The chatbot disclosure rule now covers "consumer-facing chatbots or AI agents that communicate directly with external users".
Page: Usage Policy, section "Additional Use Case Guidelines"
URL: https://www.anthropic.com/legal/aup
Accessed: 2026-10-13
Strength: A
Quote: "Agentic use cases must comply with the Usage Policy. Users are responsible for ensuring that agents they build or deploy, including actions those agents take through tools, browsers, or connected systems, comply with this Usage Policy." (verbatim (curl))
Quote: "All consumer-facing chatbots or AI agents that communicate directly with external users must disclose to users that they are interacting with AI rather than a human. This disclosure must be provided at a minimum at the beginning of each chat session or in the product interface. The disclosure does not need to identify Anthropic, Claude, or the model used." (verbatim (curl))
Also in the Universal Usage Standards of this version (relevant to running an agent on a subscription; quoted, not interpreted): "Resell, proxy, or otherwise provide access to Claude through unauthorized means, including services that route requests through consumer subscriptions or misrepresent the product or client being used" (verbatim (curl))

**AN-12.** EFFECTIVE NOVEMBER 12, 2026 version, word search of the policy body (from "Our Usage Policy (also" to "We also provide additional informational", so the site menu and footer are excluded). Non-hits (0): "trading", "broker", "own account", "self-directed", "self directed", "account owner", "yourself", "transaction", "market manipulation", "personal use", "your own", "qualified professional". Hits: "securities" 1 (the finance item only); "trade" 1 ("trade union membership"); "invest" 4 (law enforcement "investigate", "investigations", the finance item, and "how investing works" in the exclusions); "financ" 5 ("financial systems" in critical systems, "a financial account" in a surveillance carve-out, "financial or employment records" in falsified documents, "finances" in the section opening, and the finance item); "advice" 6 (all in the high-risk section); "recommendation" 15; "agent" 7 (one is "chemical agents"); "autonomous" 1 ("unmanned or autonomous platforms", weapons); "qualified" 8 (all "qualified person" or "qualified individual"); "licens" 6 (the only one about the reviewer is "holds a license where applicable law requires one"); "personal" 4 (personal data three times, and "personalized" in the finance item); "individual" 32; "professional" 2 ("professional credentials", "professional license"); "execut" 1 ("executed on equipment"); "fraud" 5. The phrase "their own" appears once in the high-risk section, in "advising an individual on their own taxes". "market" 1 ("Market, sell, or solicit funding", a verb, in the deceptive campaigns section); "manipulat" 3 (search-engine source manipulation, "subliminal, manipulative, or deceptive techniques", and "prompt injection or manipulation" in physical actions). No text on manipulating securities markets was found under any wording searched.
Page: as AN-06
URL: https://www.anthropic.com/legal/aup
Accessed: 2026-10-13
Strength: A (for absence in the text read)
Quote (the one "financial account" hit, in a surveillance carve-out, not about trading): "This section does not prohibit analysis or tracking that individuals have agreed to, such as for fraud detection or anti-money laundering screening on a financial account, or consumer apps where a user has opted in." (verbatim (curl))

### Part B: the Commercial Terms and the Consumer Terms (Q1, Q2)

**AN-13.** The Commercial Terms (effective June 17, 2025, unchanged date since run 2) are "an agreement between Anthropic and you or the organization, company, or other entity that you represent ("Customer")". So "Customer" can be "you" (a person) or an entity. They govern "Customer's use of Anthropic API keys". They also say "Services under these Terms are not for consumer use". The texts read do not define "consumer use" and do not say whether an individual using an API key for their own personal investing is "consumer use". The terms put on the Customer the job of judging "whether Outputs are appropriate for Customer's use case, including where human review is appropriate". Liability is capped at fees paid in the previous 12 months and excludes lost profits. The Services are "AS IS" with no warranty that use "WILL BE UNINTERRUPTED".
Page: Commercial Terms of Service
URL: https://www.anthropic.com/legal/commercial-terms
Accessed: 2026-10-13
Strength: A
Quote (parties and scope): "These Commercial Terms of Service ("Terms") are an agreement between Anthropic and you or the organization, company, or other entity that you represent ("Customer"). "Anthropic" means Anthropic Ireland, Limited if Customer resides in the European Economic Area ("EEA"), Switzerland or UK, and Anthropic, PBC if Customer resides anywhere else. They govern Customer's use of Anthropic API keys and any other Anthropic offerings that references these Terms, as well as all related Anthropic tools, documentation and services (the "Services")." (verbatim (curl))
Quote (business use): "Please note: You may not enter into these Terms on behalf of an organization, company, or other entity unless you have the legal authority to bind that entity. Services under these Terms are not for consumer use. Our consumer offerings (e.g., Claude.ai) are governed by our Consumer Terms of Service instead." (verbatim (curl))
Quote (D.2, Usage Policy incorporated, identity checks): "Customer and its Users may only use the Services in compliance with these Terms, including (a) the Usage Policy ("Usage Policy", which was previously referred to as the Acceptable Use Policy), (b) our policy on the countries and regions Anthropic currently supports ("Supported Regions Policy") and (c) our Service Specific Terms, each of which is incorporated by reference into these Terms. Customer must cooperate with reasonable requests for information from Anthropic to support compliance with its Usage Policy, including to verify Customer's identity and use of the Services." (verbatim (curl))
Quote (D.3, outputs and human review): "D.3. Limitations of Outputs; Notice to Users. It is Customer's responsibility to evaluate whether Outputs are appropriate for Customer's use case, including where human review is appropriate, before using or sharing Outputs. Customer acknowledges, and must notify its Users, that factual assertions in Outputs should not be relied upon without independently checking their accuracy, as they may be false, incomplete, misleading or not reflective of recent events or information." (verbatim (curl))
Quote (D.5): "D.5. Service Account. Customer is responsible for all activity under its account." (verbatim (curl))
Quote (L.2, part): "THE SERVICES AND OUTPUTS ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND ... ANTHROPIC DOES NOT WARRANT, AND DISCLAIMS THAT, THE SERVICES OR OUTPUTS ARE ACCURATE, COMPLETE OR ERROR-FREE OR THAT THEIR USE WILL BE UNINTERRUPTED." (verbatim (curl), the "..." marks text left out)
Quote (L.3.a): "the liability of each party, and its affiliates and licensors, for any damages arising out of or related to these Terms (i) excludes damages that are consequential, incidental, special, indirect, or exemplary damages, including lost profits, business, contracts, revenue, goodwill, production, anticipated savings, or data, and costs of procurement of substitute goods or services and (ii) is limited to Fees paid by Customer for the Services in the previous 12 months." (verbatim (curl))
Quote (I.3.a, part): "Anthropic may suspend Customer's access to any portion or all of the Services if: (a) Anthropic reasonably believes or determines that ... (ii) Customer or any User is using the Services in violation of Sections D.1 (Compliance), D.2 (Policies and Service Terms) or D.4 (Use Restrictions)" (verbatim (curl), the "..." marks text left out)
Quote (M.3, how the terms change): "Anthropic may update these Terms at any time, to be effective 30 days after the updates are posted by Anthropic or Customer otherwise receives Notice, except that updates made in response to changes to law or regulation take effect immediately upon posting or Notice." (verbatim (curl))

**AN-14.** Commercial Terms word search (body only, from "Welcome to Anthropic" to the site footer). The words "qualified person" and "qualified professional" do NOT appear: "qualified" has 0 hits. Other non-hits (0): "securities", "securit", "trading", "invest", "financ", "broker", "advice", "recommendation", "autonomous", "personal", "own account", "individual", "self-directed", "account owner", "yourself", "professional", "transaction", "high-risk". Hits, none about trading securities: "trade" 3 ("trademark", "in trade or commerce" in the indemnity section, "TRADE USE" in the warranty disclaimer); "agent" 1 ("employees, agents, and advisors" in confidentiality); "licens" 2 ("licensors" in liability, "license" in export controls); "fraud" 1 (indemnity exclusions); "execut" 1 ("a Customer executive", in publicity). So the Commercial Terms themselves say nothing about finance, securities, trading, investment advice, autonomous agents, or a qualified reviewer. They bring in the Usage Policy by reference (AN-13, section D.2), which is where the high-risk rules sit.
Page: Commercial Terms of Service
URL: https://www.anthropic.com/legal/commercial-terms
Accessed: 2026-10-13
Strength: A (for absence in the text read)
Quote (the A.1 "Users" definition, the only place the terms describe whom the Customer serves): "A.1. Overview. Subject to these Terms, Anthropic gives Customer permission to use the Services, including to power products and services Customer makes available to its own customers and end users ("Users")." (verbatim (curl))

**AN-15.** The Consumer Terms (which govern Free, Pro and Max plans, AN-17) still carry the securities passage today, word for word, effective October 8, 2025. It is in Section 3, "Use of our Services", in the list introduced by "You may not access or use, or help another person to access or use, our Services in the following ways:". The same list bars automated access "Except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it". The Consumer Terms also point API key and Console use to the Commercial Terms, "For clarity" excluding "Claude.ai or Claude Pro use for individuals or entities".
Page: Consumer Terms of Service
URL: https://www.anthropic.com/legal/consumer-terms
Accessed: 2026-10-13
Strength: A
Quote (effective date): "Effective October 8, 2025" (verbatim (curl))
Quote (securities passage): "To rely upon the Services, the Materials, or the Actions to buy or sell securities or to provide or receive advice about securities, commodities, derivatives, or other financial products or services, as Anthropic is not a broker-dealer or a registered investment adviser under the securities laws of the United States or any other jurisdiction." (verbatim (curl))
Quote (list heading): "You may not access or use, or help another person to access or use, our Services in the following ways:" (verbatim (curl))
Quote (automated access): "Except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it, to access the Services through automated or non-human means, whether through a bot, script, or otherwise." (verbatim (curl))
Quote (which terms govern API keys): "Please note: Our Commercial Terms of Service govern your use of any Anthropic API key, the Anthropic Console, or any other Anthropic offerings that reference the Commercial Terms of Service. For clarity, this does not include Claude.ai or Claude Pro use for individuals or entities." (verbatim (curl))
Quote (scope): "These Terms of Service ("Terms") govern your use of Claude.ai, Claude Pro, and other products and services that we may offer for individuals, along with any associated apps, software, and websites (together, our "Services")." (verbatim (curl))

**AN-16.** The Consumer Terms define "Actions" as things the service does "on your behalf", make the user "responsible for ... all Actions", and say outputs and actions should not be relied on without independent confirmation.
Page: Consumer Terms of Service, Section 4 "Inputs, Outputs, Actions, and Materials"
URL: https://www.anthropic.com/legal/consumer-terms
Accessed: 2026-10-13
Strength: A
Quote: "Our Services may generate responses (we call these "Outputs"), or enable the Services to take actions on your behalf, such as software manipulation, data processing, and system interactions (we call these "Actions"), based on your Inputs." (verbatim (curl))
Quote: "You are responsible for all Inputs you submit to our Services and all Actions." (verbatim (curl))
Quote: "Actions may not be error free or operate as you intended. You should not rely on any Outputs or Actions without independently confirming their accuracy." (verbatim (curl))

### Part C: which terms govern which route, and the Max plan's monthly API credit (Q1)

**AN-17.** Claude Code's own legal page: Claude Code is under the Commercial Terms "for Team, Enterprise, and Claude API users" and under the Consumer Terms "for Free, Pro, and Max users". Developers building products, including with the Agent SDK, "should use API key authentication". Subscription sign-in (OAuth) is "designed to support ordinary use", and "Advertised usage limits for Pro and Max plans assume ordinary, individual usage of Claude Code and the Agent SDK". The page does not say which terms apply when a Max subscriber runs Claude Code with an API key; it lists "Claude API users" under the Commercial Terms.
Page: Legal and compliance (Claude Code docs)
URL: https://code.claude.com/docs/en/legal-and-compliance.md
Accessed: 2026-10-13
Strength: A
Quote: "Your use of Claude Code is subject to: * [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) - for Team, Enterprise, and Claude API users * [Consumer Terms of Service](https://www.anthropic.com/legal/consumer-terms) - for Free, Pro, and Max users" (verbatim (curl), markdown source)
Quote: "Claude Code usage is subject to the [Anthropic Usage Policy](https://www.anthropic.com/legal/aup). Advertised usage limits for Pro and Max plans assume ordinary, individual usage of Claude Code and the Agent SDK." (verbatim (curl))
Quote: "**OAuth authentication** is intended exclusively for purchasers of Claude Free, Pro, Max, Team, and Enterprise subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications." (verbatim (curl))
Quote: "**Developers** building products or services that interact with Claude's capabilities, including those using the [Agent SDK](/docs/en/agent-sdk/overview), should use API key authentication through [Claude Console](https://platform.claude.com/) or a supported cloud provider." (verbatim (curl))
Quote: "This does not restrict how customers provision and manage their own API keys or third-party inference provider credentials [dash] for example, configuring an API key in a development environment, secrets manager, or machine image for use by the customer's own authorized users [dash] provided the resulting usage is billed to the key owner under their agreement with Anthropic (or the applicable provider) and is not resold or intermediated as described above." (verbatim (curl))

**AN-18.** The monthly API credit, reopened. Max 5x (the 100 US dollar tier) includes 100 US dollars a month of Claude Platform credit; Max 20x 200. To claim it the Max subscriber links ONE Claude Console organization and reviews the "Supplemental Credit Terms"; the subscriber must have been on the plan seven days; no card is needed on the Console to claim or use it. It covers "The Claude API (Messages API and Message Batches API)", the Console Playground, Managed Agents and the Agent SDK. It does NOT cover interactive Claude Code, extra usage, or Claude on Bedrock, Vertex AI or Foundry. On `claude -p`: covered "when you run them yourself with an API key from your linked Claude Console organization"; not covered when signed in with the plan; not covered for the Claude Code GitHub Action, IDE extension or desktop app "even with -p". It refreshes each billing cycle, does not roll over, is spent before purchased credits, and when it runs out with no other credits "API requests stop until your next monthly credits arrive". The page says "Updated this week".
Page: Monthly API credits for Max and Team plans (Claude Help Center)
URL: https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-and-team-plans
Accessed: 2026-10-13
Strength: A
Price: published
Quote (table rows): "Max 5x $100" and "Max 20x $200" (verbatim (curl), table cells joined)
Quote: "Seven days on the plan. New subscribers can claim once they've been on an eligible plan for seven days." and "No payment method needed. You don't need to add a card on Claude Platform to claim or use the credit." (verbatim (curl))
Quote: "Review the Supplemental Credit Terms, then Link organization." (verbatim (curl))
Quote: "The credits work with any available Claude model on the Claude Platform, including: The Claude API (Messages API and Message Batches API) The Playground in the Claude Console Claude Managed Agents The Claude Agent SDK The credits don't apply to: Interactive Claude Code in the terminal, IDE, desktop, or web Extra usage in Claude, Claude Code, or Claude Cowork Claude on Amazon Bedrock, Google Cloud Vertex AI, or Microsoft Foundry" (verbatim (curl), list items joined)
Quote: "Does this cover claude -p ? API credits cover claude -p and the Claude Agent SDK when you run them yourself with an API key from your linked Claude Console organization, because that usage is billed as Agent SDK usage. When you're signed in with your Claude plan instead, claude -p and Agent SDK usage still draw from your plan's usage limits and don't use your API credits. Runs started by the Claude Code GitHub Action, an IDE extension or the Claude desktop app count as Claude Code usage, so API credits don't cover them, even with -p." (verbatim (curl))
Quote: "Doesn't roll over. Unused credits expire at the end of each billing cycle. Used first. Your monthly credits are spent before any credits you've purchased." (verbatim (curl))
Quote: "If the organization has no other credits, API requests stop until your next monthly credits arrive. Usage is never charged to your Claude plan. To keep going, buy credits or turn on auto-reload in the Console." (verbatim (curl))
Quote: "Important: You can link only one Console organization, and each Console organization can receive credits from only one plan." (verbatim (curl))

**AN-19.** WHICH terms govern spending the Max API credit: the help article does not say. A search of its body found no mention of "Commercial Terms" or "Consumer Terms" (only the site footer links); its one terms reference is to the "Supplemental Credit Terms". Those Credit Terms (effective March 4, 2024) "form part of the agreement ... that links to or otherwise references these Credit Terms". The Commercial Terms reference them (section H.1). A word search of the Consumer Terms found 0 hits for "credit". The credit is spent through an API key in a Console organization, and the Consumer Terms say the Commercial Terms "govern your use of any Anthropic API key, the Anthropic Console" (AN-15). No Anthropic text read says, in one sentence, "the Max API credit is governed by the Commercial Terms". Connecting these texts is a reading, not a quote, and is listed under "Only Anthropic can settle in writing".
Page: Supplemental Credit Terms
URL: https://www.anthropic.com/legal/credit-terms
Accessed: 2026-10-13
Strength: A
Quote: "These Supplemental Credits Terms ("Credit Terms") form part of the agreement you or the organization, company, or other entity that you represent ("Customer") have with Anthropic that links to or otherwise references these Credit Terms ("Agreement")." (verbatim (curl))
Quote: "Non-Refundable. Credits issued by Anthropic, which includes Usage Credits, Promotional Credits and any other credits Anthropic offers ("Credits") are non-refundable. Usage Credits expire one calendar year from the date Anthropic sends the Confirmation Notice or otherwise issues the Credits." (verbatim (curl))
Quote: "Balance Maintenance Service. Customer may have the option to automatically reload Credits by a certain amount ("Balance Maintenance Service") when Customer reaches a certain level, which may be set by Customer on the Plans & Billing Page of Customer's Anthropic account." (verbatim (curl))
Also (Commercial Terms H.1, same access date): "Anthropic may require prepayment for the Services in the form of credits or offer other types of credits, all of which are subject to Anthropic's Supplemental Credits Terms." (verbatim (curl))

### Part D: prices, tiers, rate limits and reliability (Q1)

**AN-20.** Current model prices per million tokens (MTok), standard API, US dollars, base input / output: Fable 5.1 10 / 50; Opus 5.5 4 / 20; Sonnet 5.5 2 / 10; Haiku 5.5 0.10 / 0.50 for prompts up to 100,000 tokens (0.50 / 2.50 above). Cache, as (5 minute write / 1 hour write / hit): Fable 5.1 12.50 / 20 / 0.25; Opus 5.5 5 / 8 / 0.20; Sonnet 5.5 2.50 / 4 / 0.10; Haiku 5.5 0.125 / 0.20 / 0.01. These four are the current models in the models overview table, which says to "start with Claude Opus 5.5 for most workloads". Unchanged from run 2 (DC-35). New detail: these models use a tokenizer that "produces approximately 30% more tokens for the same text" than Sonnet 4.6 and earlier, and US-only processing (`inference_geo: "us"`) costs 1.1 times.
Page: Pricing (Claude Platform docs); Models overview (Claude Platform docs)
URL: https://platform.claude.com/docs/en/about-claude/pricing.md ; https://platform.claude.com/docs/en/models/overview.md (the address requested was .../about-claude/models/overview.md, which redirected here)
Accessed: 2026-10-13
Strength: A
Price: published
Quote (table rows; columns base input, 5m cache writes, 1h cache writes, cache hits and refreshes, output; table spacing removed; "1" and "2" are footnote marks): "| Claude Fable 5.1 | $10 / MTok | $12.50 / MTok | $20 / MTok | $0.25 / MTok1 | $50 / MTok |" ; "| Claude Opus 5.5 | $4 / MTok | $5 / MTok | $8 / MTok | $0.20 / MTok2 | $20 / MTok |" ; "| Claude Sonnet 5.5 | $2 / MTok | $2.50 / MTok | $4 / MTok | $0.10 / MTok2 | $10 / MTok |" ; "| Claude Haiku 5.5 (for prompts up to 100,000 tokens) | $0.10 / MTok | $0.125 / MTok | $0.20 / MTok | $0.01 / MTok | $0.50 / MTok |" (verbatim (curl))
Quote: "Claude 4.7 and later models and Claude Mythos Preview use a newer tokenizer that contributes to their improved performance on a wide range of tasks. This tokenizer produces approximately 30% more tokens for the same text." (verbatim (curl))
Quote: "If you're unsure which model to use, start with [Claude Opus 5.5](https://platform.claude.com/docs/en/models/opus-5-5/overview) for most workloads." (verbatim (curl), models overview)

**AN-21.** Discounts and add-on charges. Batch API: 50 percent off input and output (Opus 5.5 2 / 10, Sonnet 5.5 1 / 5, Haiku 5.5 0.05 / 0.25, Fable 5.1 5 / 25), but processing is asynchronous. Fast mode (research preview) on Opus 5.5 costs 8 / 40 and is not available with the Batch API. Managed Agents: token rates plus 0.08 US dollars per session-hour, counted to the millisecond and only while the session is `running` (unchanged from DC-32).
Page: Pricing (Claude Platform docs)
URL: https://platform.claude.com/docs/en/about-claude/pricing.md
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "The Batch API allows asynchronous processing of large volumes of requests with a 50% discount on both input and output tokens." (verbatim (curl))
Quote: "| Claude Opus 5.5 | $2 / MTok | $10 / MTok |" (batch input, batch output; verbatim (curl), spacing removed)
Quote: "| Claude Opus 5.5 | $8 / MTok | $40 / MTok |" (fast mode input, output; verbatim (curl), spacing removed)
Quote: "| Session runtime | $0.08 per session-hour | `running` status duration |" and "Runtime is measured to the millisecond and accrues only while the session's status is `running`. Time spent `idle` (waiting for your next message or a tool confirmation), `rescheduling`, or `terminated` does not count toward runtime." (verbatim (curl))

**AN-22.** Not recorded in runs 1 or 2 (run 2 named only the "Start tier", DC-39; no earlier note supports a claim that anything changed): the usage tiers are Start, Build, Scale and Custom, and the rate limits page gives NO deposit thresholds (the brief expected deposit thresholds; none exist on today's pages, see also AN-28). Placement is automatic "based on usage history and account standing". NEW organizations "may start in the Evaluation tier, with limits below the standard limits shown on this page", and the page publishes no numbers for the Evaluation tier. Each tier has a monthly spend cap: Start 500, Build 1,000, Scale 200,000 US dollars; Custom has none. At the cap, "API usage pauses until 00:00 UTC on the first day of the next month" and requests return HTTP 429 with no `retry-after` header. A user can also set a lower spend limit of their own (requests then return HTTP 400). Higher limits are asked for with "Request tier increase" in the Console.
Page: Rate limits (Claude Platform docs)
URL: https://platform.claude.com/docs/en/api/rate-limits.md
Accessed: 2026-10-13
Strength: A
Quote: "Limits are defined by **usage tier**. Organizations are placed on a tier automatically based on usage history and account standing and can move to a higher tier over time as they use the API." (verbatim (curl))
Quote: "New organizations and organizations with limited usage history may start in the Evaluation tier, with limits below the standard limits shown on this page while account history is established. These starting limits are part of how Anthropic prevents fraud and abuse, and they increase automatically as your organization builds usage history." (verbatim (curl))
Quote: "| Start | $500 USD |", "| Build | $1,000 USD |", "| Scale | $200,000 USD |" and "Organizations on the Custom tier have no monthly spend cap; limits are arranged with their account team." (verbatim (curl))
Quote: "Once you reach your tier's spend cap, API usage pauses until 00:00 UTC on the first day of the next month, unless you request a higher limit sooner." (verbatim (curl))
Quote: "All limits described here represent maximum allowed usage, not guaranteed minimums." (verbatim (curl))

**AN-23.** Rate limits at the lowest STANDARD tier (Start), per model, per minute: Opus 5.5, Sonnet 5.5 and Haiku 5.5 each 1,000 requests, 2,000,000 input tokens and 400,000 output tokens; Fable 5.1 (shared with Fable 5) 1,000 requests, 500,000 input, 100,000 output. Cached input tokens do not count toward the input limit for these models. Limits can be enforced over shorter intervals (the page's example: 60 a minute "might be enforced as 1 request per second"). A brand new account may be below these (the Evaluation tier, AN-22), at numbers not published.
Page: Rate limits (Claude Platform docs), Start tier table
URL: https://platform.claude.com/docs/en/api/rate-limits.md
Accessed: 2026-10-13
Strength: A
Quote: "| Claude Opus 5.5 | 1,000 | 2,000,000 | 400,000 |" ; "| Claude Sonnet 5.5 | 1,000 | 2,000,000 | 400,000 |" ; "| Claude Haiku 5.5 | 1,000 | 2,000,000 | 400,000 |" ; "| Claude Fable 5.x1 | 1,000 | 500,000 | 100,000 |" (Start tier rows; columns RPM, ITPM, OTPM; verbatim (curl), spacing removed)
Quote: "For all other models, cached input tokens do not count toward rate limits" (verbatim (curl))
Quote: "You might hit rate limits over shorter time intervals. For instance, a rate of 60 requests per minute (RPM) might be enforced as 1 request per second." (verbatim (curl))

**AN-24.** Reliability for a model in an order path. The API documents HTTP 529 `overloaded_error` ("The API is temporarily overloaded"), which "can occur when the API experiences high traffic across all users", plus 500 `api_error`, 504 `timeout_error`, and 429 from "acceleration limits" after a sharp increase in usage. The official SDK retries such failures twice by default. The only priority product, Priority Tier, is closed to new buyers: "Priority Tier capacity commitments are no longer available for purchase". The standard tier is "best-effort availability". No service level (uptime) commitment for a small pay-as-you-go account was found in the Commercial Terms (word search: "uptime" 0, "service level" 0; the warranty disclaimer says no warranty that use "WILL BE UNINTERRUPTED", AN-13).
Page: Errors (Claude Platform docs); Service tiers (Claude Platform docs)
URL: https://platform.claude.com/docs/en/api/errors.md ; https://platform.claude.com/docs/en/api/service-tiers.md
Accessed: 2026-10-13
Strength: A
Quote: "529 - `overloaded_error`: The API is temporarily overloaded. 529 errors can occur when the API experiences high traffic across all users. In rare cases, if your organization has a sharp increase in usage, you might see 429 errors because of acceleration limits on the API. To avoid hitting acceleration limits, ramp up your traffic gradually and maintain consistent usage patterns." (verbatim (curl), the warning box joined to the line above it)
Quote: "The official SDK automatically retries transient failures (such as connection errors, rate limits, and 5xx server errors) with exponential backoff, twice by default, honoring the `retry-after` header when present." (verbatim (curl))
Quote: "Priority Tier capacity commitments are no longer available for purchase. Organizations with an existing commitment can continue to use Priority Tier through their contract end date, and this page remains available as a reference for them. If you need guaranteed capacity, [contact sales](https://claude.com/contact-sales)." (verbatim (curl))
Quote: "The standard tier is the default service tier for all API requests. The API prioritizes these requests alongside all other requests with best-effort availability." (verbatim (curl))

**AN-25.** Claude status page, today: "All Systems Operational", with separate components for "Claude API (api.anthropic.com)" and "Claude Console (platform.claude.com)". The incident history on the page lists up to seven incidents between September 29 and October 13, 2026 (the October 13 entry carries updates dated back to October 7, so it may be the same usage-data incident also listed on October 7), including "Elevated errors for Claude Opus 5.5" (October 6) and "Elevated errors on claude.ai, Claude Code, Claude Cowork and the Claude API" (September 29). The 90 day uptime percentages are drawn by the page's scripts and were not in the downloaded text, so no uptime figure is recorded here (Needs a browser). This is a count of incident titles, not a measurement of how long the API was unavailable.
Page: Claude Status
URL: https://status.claude.com/
Accessed: 2026-10-13
Strength: A
Quote: "All Systems Operational Uptime over the past 90 days. View historical uptime. claude.ai Operational Claude Console (platform.claude.com) Operational Claude API (api.anthropic.com) Operational" (verbatim (curl), lines joined)
Quote (incident titles, with the page's dates): "Oct 13, 2026 Elevated errors on platform.claude.com"; "Oct 7, 2026 Issue with spend limits"; "Elevated errors loading usage data on platform.claude.com"; "Oct 6, 2026 Elevated errors for Claude Opus 5.5"; "Oct 5, 2026 Elevated errors for Claude Mythos 5.1 and Claude Fable 5.1"; "Oct 1, 2026 Delayed credits on the Claude Platform"; "Sep 29, 2026 Elevated errors on claude.ai, Claude Code, Claude Cowork and the Claude API" (verbatim (curl))

### Part E: opening and paying for a Console (API) account (Q1)

**AN-26.** What signup and use require, from Anthropic's help center. To use the API, an organization adds prepaid usage credits after filling out "some additional information about your organization and use case" and entering payment details. A Claude account needs a phone number from a supported location that can receive a text message, with no way to skip it ("We require phone verification for all new users"); whether the separate Console signup asks for the phone again was not stated in the articles read. Console login is by Google sign-in or an emailed link; no password. A Claude account and a Console account can share one email address and "operate independently". No help article read says that only businesses may open a Console account, and none says individuals may; the Commercial Terms' "Customer" can be "you" (AN-13). No identity-document check at signup was described in the pages read; the Commercial Terms allow Anthropic to ask later "to verify Customer's identity" (AN-13).
Page: "I created a Claude Console organization - how do I start using the Claude API?"; "Verify your phone number"; "Log in to your Console account"; "Can I have a Claude account and a Console account?" (Claude Help Center)
URL: https://support.claude.com/en/articles/8114531-i-created-a-claude-console-organization-how-do-i-start-using-the-claude-api ; https://support.claude.com/en/articles/8287232-verify-your-phone-number ; https://support.claude.com/en/articles/13371040-log-in-to-your-console-account ; https://support.claude.com/en/articles/8987223-can-i-have-a-claude-account-and-a-console-account
Accessed: 2026-10-13
Strength: A
Quote: "To use the Claude API and the playground, add usage credits to your organization's balance. You'll need to fill out some additional information about your organization and use case. Then, you'll enter your payment details and fund your account." (verbatim (curl))
Quote: "Once you've purchased usage credits for your account, you're ready to use the API in your commercial application." (verbatim (curl))
Quote: "When you first create a Claude account, you'll be asked to enter your phone number from a supported location to receive a verification code via text message." and "You must have a phone number that can receive a verification code via text message to create and use a Claude account. We require phone verification for all new users, and there isn't a way to skip this step." (verbatim (curl))
Quote: "Click "Continue with Google" if you want to use your Google account credentials to log in to the Console." and "It's not possible to create a dedicated password for your Console account at this time." (verbatim (curl))
Quote: "Yes. You can have a Claude account (free, Pro, Max, Team, or Enterprise) and a Console account (to access the Claude API) with the same email address. These two accounts will operate independently." (verbatim (curl))
Dead end: the older help article "How do I claim my free credits" (8994925), found by search, returned 404 today, so no current free starting credit is recorded.

**AN-27.** Billing. API use is paid with prepaid credits bought in the Console (Settings > Billing), available immediately, expiring one year after purchase, non-refundable. Auto-reload buys more when the balance falls below a threshold the owner sets. Monthly invoicing exists only through Anthropic's sales team. Only successful calls are billed, but a request that was on track to succeed is still charged if the client disconnects. When credits run out, API calls stop. A paid Claude plan and the API are "separate products" billed separately; the Max plan's monthly credit is the one link between them (AN-18).
Page: "How do I pay for my Claude API usage?"; "I have a paid Claude subscription ... Why is Claude API usage billed separately from my paid Claude plan?" (Claude Help Center)
URL: https://support.claude.com/en/articles/8977456-how-do-i-pay-for-my-claude-api-usage ; https://support.claude.com/en/articles/9876003-i-have-a-paid-claude-subscription-pro-max-team-or-enterprise-plans-why-is-claude-api-usage-billed-separately-from-my-paid-claude-plan
Accessed: 2026-10-13
Strength: A
Quote: "Claude API and playground usage is billed through prepaid usage credits. Buy credits before you use the API, and they're applied to your usage according to our current pricing. Purchased credits cover API access, playground usage, and Claude Code." (verbatim (curl))
Quote: "You're billed only for successful API calls and completed tasks. Failed requests aren't charged. Note: If your client disconnects or times out in the middle of a request that was on track to succeed, that request is still charged. If you run out of credits, you can no longer call the API or use the playground until you add more." (verbatim (curl))
Quote: "Auto-reload purchases additional credits automatically when your balance falls below a threshold you set." (verbatim (curl))
Quote: "Credits expire one year from the purchase date, and the expiration date can't be extended. Expired credits appear in your Invoice history on the Billing page. All credit purchases are non-refundable." (verbatim (curl))
Quote: "Some organizations are billed monthly in arrears instead of buying credits upfront. This applies to Console organizations with an invoicing arrangement set up through our Sales team." (verbatim (curl))
Quote: "Claude paid plans and the Claude Console are separate products designed for different purposes" (verbatim (curl))

**AN-28.** Usage tiers have NO deposit thresholds today: "There's no deposit or purchase that moves you up". Tiers are assigned automatically. Higher limits can be requested in the Console "once you're using at least 50% of your current limits". Claiming the Max API credit "doesn't otherwise change your usage tier" (only Team-linked organizations are moved to at least Build). Arithmetic, not a quote: the Max 5x credit (100 US dollars a month) is below the Start tier's 500 dollar monthly spend cap (AN-22).
Page: "How can I get higher rate limits on the Claude API?" (Claude Help Center)
URL: https://support.claude.com/en/articles/10366389-how-can-i-get-higher-rate-limits-on-the-claude-api
Accessed: 2026-10-13
Strength: A
Quote: "Usage tiers are assigned automatically. There's no deposit or purchase that moves you up, and you don't need to take any action. Claude Console organizations linked to a Team plan for monthly API credits move to at least the Build tier, so the full $500 monthly credit fits under the organization's spend limit. Claiming monthly API credits doesn't otherwise change your usage tier." (verbatim (curl))
Quote: "If you need higher limits, you can request them in the Claude Console once you're using at least 50% of your current limits." (verbatim (curl))

**AN-29.** Supported regions. The United States is listed. Use is barred for persons "while physically located in an unsupported region", and the Commercial Terms incorporate this Supported Regions Policy (AN-13, section D.2).
Page: Supported countries and regions (Anthropic); "Where can I access Claude?" (Claude Help Center)
URL: https://www.anthropic.com/supported-countries ; https://support.claude.com/en/articles/8461763-where-can-i-access-claude
Accessed: 2026-10-13
Strength: A
Quote: "Anthropic's products and services [dash] including our apps (such as Claude.ai, Claude Code, and Cowork), our API and developer platform, and Claude models offered through cloud platforms and authorized resellers [dash] are available only in the countries and regions listed below." and "Use by persons while physically located in an unsupported region, including users and personnel of otherwise supported entities." (verbatim (curl))
Quote: "United States of America" (list entry, verbatim (curl)); the help article lists "United States" (verbatim (curl)).

**AN-30.** Max plan price on Anthropic's own pages today: Max 5x is 100 US dollars a month, Max 20x 200, monthly billing only. The pricing page shows Max "From $100 Per month" with "$100 to $200/month in API credits to build on the Claude Platform". The Max help article says Anthropic "may limit your usage in other ways, such as weekly and monthly caps".
Page: "What is the Max plan?" (Claude Help Center, "Updated today"); Pricing (claude.com)
URL: https://support.claude.com/en/articles/11049741-what-is-the-max-plan ; https://claude.com/pricing
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Max 5x: $100 per month Max 20x: $200 per month" and "The Max plan is currently available as a monthly subscription only." (verbatim (curl))
Quote: "From $100 Per month" and "$100 to $200/month in API credits to build on the Claude Platform" (verbatim (curl), pricing page)
Quote: "In addition, to manage capacity and ensure fair access to all users, we may limit your usage in other ways, such as weekly and monthly caps or model and feature usage, at our discretion." (verbatim (curl))

### Part F: Anthropic's explanations of the high-risk rules and the November 12, 2026 change (Q2)

**AN-31.** MISSED BY RUN 2 (see Contradictions with run 2): Anthropic published a news post, dated October 8, 2026 (the day before run 2 read the pages), explaining the November 12 Usage Policy. On high-risk use cases it says the requirements "haven't changed" and the section was rewritten so users can tell "whether a given use case has these requirements". It describes the qualified "human in the loop" as "someone who has the authority to review and, if necessary, change Claude's recommendations". The post does not mention personal, self-directed or own-account use, and does not say whether the person affected can be the reviewer (word search of the post body: "personal" 2 hits, "personalized vote and campaign targeting" and "voters' personal data"; "own account" 0; "self-directed" 0; "account owner" 0; "yourself" 0; "trading" 0; "broker" 0; "securities" 0; "invest" 1, "investigate", law enforcement; "qualified" 2, in "qualified "human in the loop"" and "qualified operator"; the exact phrase "qualified person" 0).
Page: 2026 Usage Policy update (Anthropic news, dated Oct 8, 2026)
URL: https://www.anthropic.com/news/2026-usage-policy-update
Accessed: 2026-10-13
Strength: A
Quote: "When our products are used in ways that can affect someone's health, legal rights, finances, livelihood, or access to essential services, we require there to be a qualified "human in the loop" (that is, someone who has the authority to review and, if necessary, change Claude's recommendations), and for the individual affected to be told that AI was used." (verbatim (curl))
Quote: "These requirements haven't changed with the updated version of our Usage Policy. However, users have often asked us whether a given use case has these requirements, so we've rewritten our High-risk Use Case Requirements section to answer that more directly. It now lists which kinds of recommendations are covered and which are not." (verbatim (curl))
Quote: "The updated policy takes effect on November 12." (verbatim (curl))
Quote: "Most of the updates in the latest version are intended to clarify existing rules. In the year since our last refresh, Claude has taken on longer, more independent work." (verbatim (curl))
Note, not interpretation: the post's statement that the requirements "haven't changed" sits beside two textual differences between the versions recorded above: the in-force overview says "consumer-facing use cases" (AN-03) and the new overview says "use cases that pose an elevated risk of harm to individuals" (AN-06); and the in-force rule says "qualified professional in that field" without a definition (AN-03) while the new one says "qualified person" with a definition (AN-08). The post does not discuss either difference.

**AN-32.** Anthropic's help article on agents, reopened: unchanged from run 2 (still dated March 16, 2026). Under the heading "Do Not Use Agents for Unauthorized System Access or Manipulation" it lists "unauthorized, illegal, or fraudulent financial transactions (such as brokerage or investment advisory activities)". It does not address an authorized, lawful transaction in the user's own account.
Page: Using Agents According to Our Usage Policy (Claude Help Center, dated March 16, 2026)
URL: https://support.claude.com/en/articles/12005017-using-agents-according-to-our-usage-policy
Accessed: 2026-10-13
Strength: A
Quote: "Engage in unauthorized, illegal, or fraudulent financial transactions (such as brokerage or investment advisory activities) or payment processing" (verbatim (curl))
Quote: "The following are intended to be non-exhaustive illustrations of how our Usage Policy applies to certain agentic uses." (verbatim (curl))

**AN-33.** Software Directory Policy, reopened: unchanged (dated April 15, 2026). Software that "executes financial transactions on behalf of users" is not admitted to Anthropic's directories "Unless otherwise expressly permitted by us in writing". This is a rule about LISTING software in Anthropic's directories (DC-17); the live Usage Policy now cross-refers to it for "Software listed in our Directories" (AN-11 page).
Page: Anthropic Software Directory Policy, section "4. Unsupported Use Cases" (Claude Help Center)
URL: https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy
Accessed: 2026-10-13
Strength: A
Quote: "Unless otherwise expressly permitted by us in writing, we do not allow Software with certain capabilities into our Directories. We may revisit these restrictions as our Directories and Anthropic Services evolve. A. Software that transfers money, cryptocurrency, or other financial assets, or executes financial transactions on behalf of users." (verbatim (curl))

**AN-34.** Other Anthropic help articles in the Safeguards collection were checked for anything on high-risk use, self-directed use or reviewer identity. None found. The collection lists 20 articles; none is about high-risk use cases. The older update article (9301722, dated March 16, 2026) mentions "high-risk use cases" only in one summary line. The "Exceptions to our Usage Policy" article concerns government customers only. The "Identity verification on Claude" article says Anthropic is "rolling out identity and business verification for a few use cases", using Persona, with a government photo ID and possibly a live selfie for individuals; it does not name which use cases.
Page: Safeguards collection; "Updates to our Acceptable Use Policy ..."; "Exceptions to our Usage Policy"; "Identity verification on Claude" (Claude Help Center)
URL: https://support.claude.com/en/collections/4078535-safeguards ; https://support.claude.com/en/articles/9301722-updates-to-our-acceptable-use-policy-now-usage-policy-consumer-terms-of-service-and-privacy-policy ; https://support.claude.com/en/articles/9528712-exceptions-to-our-usage-policy ; https://support.claude.com/en/articles/14328960-identity-verification-on-claude
Accessed: 2026-10-13
Strength: A (for absence in the text read)
Quote: "More specific risk levels: We've broken out some specific "high-risk use cases" that have additional requirements due to posing an elevated risk of harm." (verbatim (curl), article 9301722)
Quote: "We are rolling out identity and business verification for a few use cases, and you might see a verification prompt when accessing certain capabilities, as part of our routine platform integrity checks, or other safety and compliance measures." (verbatim (curl))
Quote: "If you are verifying as an individual, have these ready: A valid government-issued photo ID: the physical document, in hand A phone with a camera: you may be asked to take a live selfie with your phone" (verbatim (curl), list items joined)
Search note: two web searches for an Anthropic article on high-risk use or self-directed finance use returned only third-party pages (strength C and D, not used as evidence) and Anthropic's own news post (AN-31).

**AN-35.** What the texts DO NOT say, gathered as word-search results (Q2). Across the in-force Usage Policy (AN-05), the November 12 Usage Policy (AN-12), the Commercial Terms (AN-14) and the October 8 news post (AN-31):
- "account owner": 0 in all four.
- "own account": 0 in all four.
- "self-directed" and "self directed": 0 in all four.
- "personal use": 0 in all four.
- "yourself": 0 in all four.
- "trading": 0 in all four. "broker": 0 in both Usage Policy versions and the Commercial Terms.
- "qualified person": 0 in the in-force Usage Policy, 0 in the Commercial Terms, 0 in the news post (which says qualified "human in the loop" and "qualified operator"), present only in the November 12 Usage Policy.
- "qualified professional": 1 in the in-force Usage Policy, 0 in the November 12 version, 0 in the Commercial Terms.
- No text read says whether the "individual who might rely on it" (AN-08), the "impacted individual" (AN-06) or the "individual who receives advice or who is the subject of a decision" (AN-09) can be the same person as the user who builds or deploys the agent, and no text read says whether that person can be the "qualified person".
- No text read says what training or experience is enough to be "someone with the training or experience to evaluate the output in that field" (AN-08), and none names the license, if any, that "applicable law requires" for buying or selling securities for one's own account.
- No text read explains how "the individual" in the exclusion "applying a fixed rule, formula, or algorithm where the model exercises no judgment about the individual" (AN-10) applies when the only individual is the user.
Strength: A (for absence in the texts read)

**AN-36.** The Service Specific Terms (effective August 31, 2026), which the Commercial Terms incorporate (AN-13, D.2), were word-searched too: 0 hits in the body for every term in the brief's list (securities, trade, trading, invest, financial, broker, advice, recommendation, agent, autonomous, qualified, license, personal, own account, individual). They matter for one reason: Managed Agents is labelled beta (DC-30, DC-31), and beta services "may not be suitable for production use", with Anthropic's liability for them capped at the lesser of 1,000 US dollars and 12 months' fees.
Page: Service Specific Terms, section "B. Beta Services"
URL: https://www.anthropic.com/legal/service-specific-terms
Accessed: 2026-10-13
Strength: A
Quote: "Anthropic may offer Services that are in pre-release, beta, preview or similar trial form ("Beta Services"). This means that they may not be suitable for production use and are provided "as-is" on a temporary basis. Anthropic is not responsible for Customer's use of or reliance on Beta Services and is not obligated to provide any indemnity for their use. Anthropic's liability related to Beta Services is limited to the lesser of $1,000 and Fees paid by Customer for the Services in the previous 12 months." (verbatim (curl))

**AN-37.** A reliability contrast, quoted not interpreted: Anthropic advertises "priority access" at busy times for paid Claude plans, including Max, while the API's standard tier is "best-effort availability" and the API's Priority Tier is closed to new buyers (AN-24). No Anthropic page read says whether a Max plan's priority access carries over to API calls paid with the Max API credit; the credit article says the credits are "Separate from your plan limits" (AN-18).
Page: Pricing (claude.com); "I have a paid Claude subscription ... Why is Claude API usage billed separately from my paid Claude plan?" (Claude Help Center)
URL: https://claude.com/pricing ; https://support.claude.com/en/articles/9876003-i-have-a-paid-claude-subscription-pro-max-team-or-enterprise-plans-why-is-claude-api-usage-billed-separately-from-my-paid-claude-plan
Accessed: 2026-10-13
Strength: A
Quote: "Priority access at high traffic times" (verbatim (curl), Max plan feature list on the pricing page)
Quote: "Claude paid plans give subscribers access to Claude on the web, desktop, and mobile, and offer enhanced features like more usage and priority access during high-traffic periods." (verbatim (curl))

## Contradictions with run 2

- DC-20 said "No Anthropic announcement explaining the November 12, 2026 version was found in this session". Anthropic's news post "2026 Usage Policy update" is dated October 8, 2026, the day before run 2's reading, so it existed then and was missed (AN-31).
- DC-16 said the Commercial Terms word search found "securit" only as data security. Today's body search found 0 hits for "securit" in the Commercial Terms text (AN-14). The difference may come from where each run cut the page (run 2 may have included the Data Processing Addendum link text or footer). Either way, there is no securities text in the terms.
- No other run 2 finding in this topic was contradicted. Prices (DC-35), Managed Agents runtime (DC-32), Start tier limits (DC-39), the API credit (DC-34), the Consumer Terms passage (DC-14) and both Usage Policy texts (DC-03 to DC-11) read the same today.

## Not verified

1. The rate limits and spend cap of the "Evaluation tier" that a new organization may start in (AN-22). Not published.
2. What the Console signup form asks for (account type, organization name, use case questions, phone, card). Only the help articles were read (AN-26); the form itself needs a sign-in, which the brief forbids.
3. Whether a Console signup triggers the Persona identity check (AN-34). The article says only "a few use cases".
4. Whether any free starting credit exists for new Console accounts today (the old article returned 404, AN-26).
5. The 90 day uptime percentage for the Claude API (AN-25).
6. Whether Anthropic intends a newer Commercial Terms or Consumer Terms version. Both pages show only their current effective dates (June 17, 2025 and October 8, 2025) and a "Previous Version" link; no pending version was seen.
7. The full text of the Data Processing Addendum and Supported Regions details beyond the United States listing. Not read; outside the two questions.

## Needs a browser

1. Status page uptime figures (https://status.claude.com/), drawn by scripts.
2. The Console's Rate limits and Billing pages, which would show the actual tier and spend cap of a new organization. These need a sign-in, so even a browser would require the owner to sign in himself.

## Only Anthropic can settle in writing

Each is one yes or no question that could be sent to Anthropic. The texts read leave each one open (AN-35).

1. Is an individual who uses an Anthropic API key for his own personal investing engaged in "consumer use" under the Commercial Terms sentence "Services under these Terms are not for consumer use" (AN-13)?
2. Is spending the Max plan's monthly API credit governed by the Commercial Terms (AN-19)?
3. Under the November 12, 2026 Usage Policy, can the user who builds and deploys the agent also be "an individual who might rely on it" and also be the "qualified person" who reviews it (AN-08)?
4. Is there a minimum "training or experience" that makes someone a "qualified person" for a finance High-risk AI Recommendation, and is any license required for a person deciding trades in his own brokerage account (AN-08)?
5. When an agent places an order in the user's own account, is the model's recommendation "used to implement a decision" (requiring prior review, AN-08)?
6. When the only individual concerned is the user, does a trading agent fall within the exclusion "applying a fixed rule, formula, or algorithm where the model exercises no judgment about the individual" if fixed code applies the rules and the model only researches (AN-10)?
7. Is "Internal drafting, research, summarization, or analysis that is not the ultimate High-risk AI Recommendation delivered" (AN-10) meant to cover research the model hands to fixed code or to the user, who then decides?
8. Until November 12, 2026, does the in-force policy's phrase "specific consumer-facing use cases" (AN-03) cover a person's own use of Claude for his own investments?
9. Does the word "unauthorized" in the agents article's "unauthorized, illegal, or fraudulent financial transactions" (AN-32) leave authorized, lawful trades in the user's own account outside that example?
10. Does the Consumer Terms passage "To rely upon the Services ... to buy or sell securities" (AN-15) apply to Claude Code or `claude -p` run on a Max subscription login when the code it writes places trades?
11. What are the Evaluation tier's request, token and spend limits for a new organization (AN-22)?
12. Does a Max plan's advertised "priority access" apply to API calls paid with the Max API credit (AN-37)?

End of file marker
