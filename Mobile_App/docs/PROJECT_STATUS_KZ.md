# ASAR AI — нақты мәртебе (2026-11-02)

**MVP 1.1:** React Native + Expo SDK 54, жергілікті AsyncStorage; 5 түрлі AI аптасының есептеу коды бар. Backend, GPS, push, көпқұрылғылы синхрондау, APK жоқ.

| Апта | Тақырып | Қазіргі статусы |
|---|---|---|
| 1 | Intelligent Agents | **Іске асқан** — agentNextStep |
| 2 | Search, A* | **Іске асқан** — aStar, шартты граф |
| 3 | CSP, Local Search | **CSP іске асқан**, Hill Climbing жоспардағы бөлік |
| 4 | Adversarial Search | Жоспарда — Minimax симуляторы |
| 5 | MDP, Reinforcement Learning | Жоспарда — Q-learning |
| 6 | Probability, Bayesian Networks | **Іске асқан** — Naive Bayes шартты желісі, posterior |
| 7 | Hidden Markov Models | **Іске асқан** — Forward, Viterbi, 3 жасырын күй |
| 8 | Classical ML | Жоспарда — нақты үйретілген жіктеу |
| 9 | Neural Networks | Жоспарда — сурет классификаторы |
| 10 | LLM, Generative AI, AI Safety | Жоспарда — көмекші, қауіпсіздік |

**31/31 unit test өтті**, соның ішінде Bayesian 6, HMM 9. Бұл нақты волонтер деректерінен үйретілген немесе валидтелген статистикалық модель емес. CPT, HMM өту/эмиссия матрицалары — синтетикалық.

**Қорғауда:** өтініш қосу → сәйкестендіру модаліндегі Bayesian пайызы → басты беттен AI аналитика → HMM сценарийін өзгерту → npm test көрсету.
