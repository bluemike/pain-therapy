# Liebscher & Bracht (LnB): groundwork summary for a patient-management app

Status: 2026-10-12. Part A is built from public sources. Part B covers the 3 PDFs in the OneDrive `pain-therapy` folder; each PDF also has its own detailed file.

## Part A: The method, from public sources

### Who and what
- Founders: Roland Liebscher-Bracht (trained as an industrial engineer) and Dr. med. Petra Bracht (general and nutritional medicine).
- They describe themselves as "pain specialists" with 30 to 35 years of experience, more than 3,000 partner therapists, over 600 YouTube videos, an app, books (GU series "Schmerzen selbst behandeln" by region), and tools such as fascia rollers, balls and an exercise loop.
- Therapists come from physiotherapy, medicine or Heilpraktiker backgrounds. They become "LnB-Therapeuten" after an online seminar, a three-day practical course and an exam.

### Pain model
- Most pain comes from **excessive muscular-fascial tension** ("überhöhte muskulär-fasziale Spannungen", "überspannte Muskeln und verfilzte Faszien"). Under this model, wear of the structure is not the main cause.
- The tension builds up through **one-sided movement patterns and too little movement**, for example long sitting, standing or the same sleep position. Muscles and fascia lose flexibility (they "shorten"), and that puts more pressure on joints and vertebrae.
- The brain registers this harmful pressure and warns with **"Alarmschmerz"** (alarm pain), which the method treats as a protective signal rather than a sign of damage.
- The stated goal is to lower tension and restore the full range of motion so the alarm is no longer needed.

### The three techniques: "Dehnen, Rollen, Drücken"
1. **Osteopressur (pressing)**: done by the therapist. Pressure is applied to "Alarmschmerz-Rezeptoren" in the periosteum (the skin covering the bone) at defined points. The claim is that this "resets" the brain's pain programs and normalizes muscle tension. Patients do a simplified version themselves with balls or their fingers: increase pressure slowly and stay on a point until the pain eases.
2. **Engpassdehnungen (bottleneck stretches)**: whole-body stretches aimed at the "bottleneck" positions a person rarely reaches. Rules from the official LnB guide:
   - Intensity is rated on a 1 to 10 scale. The target is a "Wohlfühlschmerz" (a stretch that hurts but feels good) at about **8 to 9.5**, never above 10.
   - Hold for **2 to 2.5 minutes** per stretch. Shorter holds are said to do little.
   - Beginners or people in strong pain build up step by step. Keep breathing calmly.
   - In some protocols the therapist adds a "Gegenspannung" (brief tensing against the stretch). The public self-help guide says not to tense during the stretch, so the exact rules differ between therapist and self-help versions.
3. **Faszien-Rollmassage (rolling)**: self-treatment with LnB rollers and balls. Roll very slowly and with high pressure, in one direction toward the heart, about 2 to 2.5 minutes per area.

### Typical patient journey (as described by practices and LnB)
1. **Intake**: pain history, pain location(s), the patient's pain rating, and movement and posture habits.
2. **Therapist session**: Osteopressur first, then guided stretches and rolling. Practices often report noticeable relief within the session.
3. **Short treatment series**: LnB claims an average of **2 to 3 treatments** are enough to "reset" the pain programs. A Swiss practice runs it within a 9-session physio prescription, with at most 25 minutes of treatment billed per session.
4. **Home program**: a personal set of exercises for **10 to 15 minutes a day, ideally 6 days a week**, supported by the app, videos, books and rollers. LnB stresses that consistent home exercise decides whether the result lasts.
5. **Follow-up and maintenance**: check pain and mobility, adjust the exercises, then switch to a long-term routine.

### Billing in Switzerland (one practice's example)
- The LnB therapy itself is not covered by basic health insurance and is sold at a one-time private price.
- Practices fold Osteopressur into manual therapy under a doctor's physio prescription, which is billable up to 25 minutes per session.

### Evidence and criticism (relevant for claims and wording in the app)
- LnB advertising claims 80 to 95% success. These figures come from the founders and have not been independently confirmed.
- A 2022 review by Suda et al. in *Zeitschrift für Orthopädie und Unfallchirurgie* found **no scientific evidence** for the explanatory model or the treatment claims. For example, joint damage and genetics are established causes of arthritis.
- The founders have received a cease-and-desist letter over some of their advertising claims. Physio Austria has also criticized the method publicly.
- The University of Potsdam (sports medicine) ran a 6-week LnB study on patients with back pain. The project page could not be fetched, so its results are not included here.
- For the app, this means it should record outcomes neutrally (pain scores, range of motion, adherence) and avoid built-in healing claims.

### What this suggests for the app's data model (first draft)
- **Patient**: master data, insurance and prescription (physio prescription, number of sessions), consent.
- **Complaint or episode**: body region(s), start date, history, red flags and diagnoses from a doctor.
- **Session**: date, therapist, Osteopressur points used, stretches and rolling done, pain on a 0 to 10 scale before and after, range-of-motion notes.
- **Exercise library**: Engpassdehnungen, rolling and pressing exercises, organized by body region, with instructions, duration (2 to 2.5 minutes) and target intensity (8 to 9.5).
- **Home program**: exercises assigned to a patient, with frequency (for example 6 days a week, 10 to 15 minutes) and an adherence log, possibly entered by the patient.
- **Progress**: pain trend per region, number of sessions, goal reached.

### Sources
- [Physio Santewell Basel: LnB therapy](https://physio-santewell.ch/liebscher-bracht-therapie-basel) and [pain therapy article](https://physio-santewell.ch/2020/09/22/schmerztherapie)
- [LnB guide on the Achilles tendon (PDF, official)](https://www.liebscher-bracht.com/wp-content/uploads/2019/08/PDF-Ratgeber_Achillessehne_01.pdf)
- [liebscher-bracht.com: pain encyclopedia](https://www.liebscher-bracht.com/schmerzlexikon/) and [Dehnen, Rollen, Drücken](https://www.liebscher-bracht.com/therapie/anleitung/)
- [IWW: "LnB method: big promises, little evidence"](https://www.iww.de/pp/perspektiven/behandlungsansaetze-liebscher-bracht-und-ihre-lnb-methode-grosse-versprechen-kaum-evidenz-f147120)
- [Physio Austria interview (PDF)](https://www.physioaustria.at/sites/default/files/2023-04/2023-04-06_Standard_Interview%20zu%20Liebscher%20und%20Bracht.pdf)
- [Uni Potsdam study project](https://www.uni-potsdam.de/de/sportmedizin/wissenschaft/projekte/abgeschlossene-projekte/wirksamkeitsnachweis-des-konzepts-einer-6-woechigen-therapie-nach-liebscher-bracht-lb-bei-patienten-mit-rueckenschmerzen) (not readable)

## Part B: OneDrive `pain-therapy` PDFs

The three PDFs together describe the whole documentation workflow of a Swiss L&B practice (Gesundheitszentrum Gut AG, Mettmenstetten and Zürich).

| PDF | What it is | Detail file |
|---|---|---|
| Sammelmappe 12 Behandlungsbögen | 12 therapist treatment forms, one per body region, built on a catalogue of about 80 Osteopressur points | [pdf1-behandlungsboegen.md](pdf1-behandlungsboegen.md) |
| Sammelmappe 27 Übungsblätter | 27 patient exercise handouts (codes 1A–4G) with prescription fields | [pdf2-uebungsblaetter.md](pdf2-uebungsblaetter.md) |
| 2026-10-11 09-36 (scan) | Blank forms: body chart, intake, pain history, progress log, patient information, privacy notice | [pdf3-anamnese-formulare.md](pdf3-anamnese-formulare.md) |

### Key facts from the PDFs
- **Region structure:** there are 12 regions, from 1 (head and neck) to 12 (lower leg and foot). Each region lists its Osteopressur points and its prescribed stretch codes.
  - Points have hierarchical IDs in 4 groups: 1 head and neck, 2 trunk, 3 arm, 4 leg (for example 1.1.1).
  - On each sheet, orange bold marks the main points.
  - Regions share points and exercises.
- **Per treatment:**
  - pain in % before treatment, and the residual pain after it (0–100% in steps of 10)
  - for each point: treated left or right, and sensitivity (low, medium, strong, extreme)
  - for each exercise: prescribed or not, and difficulty (easy, medium, hard, impossible) with variants
  - up to 6 rolling entries, each an area and a tool (MiKu, MeKu, MiRo, MeRo)
- **Exercise protocol:** each stretch has 3 steps of about 30 s each:
  - increase the stretch
  - tense for 7 s, release, stretch further for 3 s, 3 times, then about 8–12 faster cycles
  - hold the end position actively
  
  The prescription per patient sets times per week, times per day, intensity and steps. Intensity must stay below 10.
- **Treatment course (practice handout):**
  - 3 to 5 treatments per pain area
  - home stretching for 1 month, 6 times a week, twice a day
  - no other therapies or painkillers in parallel, and no abrupt stop of strong medication
  - after Osteopressur: possible bruises and temporary worsening within 24 h
- **Patient progress log:** pain before treatment counts as 100%, and the pain right after is rated as a % of that. Follow-up ratings come after a few hours, the first night, day 1, and day 2 until the next treatment.
- **Intake and compliance:**
  - master data and anamnesis (smoking, risk factors, orthopaedic and internal diagnoses, medication, pregnancy)
  - up to 3 pains with location, quality, intensity, depth and pattern, plus body-chart markings
  - consents: liability waiver, data processing, unencrypted email, signature
  - records kept 20 years after the last treatment, with export, correction and withdrawal of consent supported
- **Differences from the public sources:**
  - The practice expects 3–5 treatments per area, while LnB marketing says 2–3.
  - The 3-step protocol includes deliberate tensing against the stretch, which the public self-help guide advises against.
  - In the app, the practice's own documents should take precedence.

### Domain model derived from the PDFs (proposal)
- **Patient**: master data, insurer, GP, emergency contact. Linked to Consent records and to an Anamnesis.
- **Complaint**: up to 3 per patient, with location, quality, intensity, depth, pattern, body-chart markings and trigger references.
- **Catalogue**:
  - Region (12)
  - OsteopressurePoint (about 80, in 4 groups)
  - Exercise (27, with steps, variants and rolling instructions)
  - RegionPoint, a region-to-point link with an is_main flag
  - RegionExercise, a region-to-exercise link
- **Treatment**: patient, region, number, date, therapist, pain before and after in %, and comparison notes.
  - TreatedPoint: side and sensitivity
  - ExerciseAssessment: prescribed, difficulty, variant
  - RollEntry: area and tool
- **HomeProgram**: Prescription with times per week, times per day, intensity and steps, and an ExerciseLog filled in by the patient.
- **ProgressLog**: pain right after treatment in %, plus 4 follow-up ratings with notes.
