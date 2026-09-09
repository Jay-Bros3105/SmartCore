# Neo SmartCore — Tablet App ya Wasimamizi (Branch Manager)

App ya kwanza ya Expo/React Native kwa ajili ya **Neo SmartCore**, kulingana na
Full System Proposal (Septemba 2026) ya JSL FastLine Technologies. Toleo hili
linalenga mtumiaji wa aina ya **Branch Manager (Msimamizi wa Duka)** kwenye
tablet, kama ilivyoainishwa Sehemu ya 5 na 9 ya proposal.

## Ilichojengwa kwenye toleo hili

- ✅ **Splash Screen yenye animation** — logo inaanza transparent kabisa,
  inafifia (fade-in) kwa takribani sekunde 6, kisha jina "Neo-SmartCore" na
  tagline vinatokea huku logo ikibounce taratibu. Background ni light blue
  kulingana na palette ya Sehemu 12 ya proposal.
- ✅ **Home Dashboard ya Msimamizi** — muhtasari wa siku (fedha zinazotarajiwa,
  hali ya zamu), arifa ya stock ya chini, na kadi za shughuli zote sita za
  Branch Manager (Ufunguzi, Upokeaji wa Stock, Ufungaji wa Siku, Upatanisho wa
  Fedha, Omba Stock, Matumizi), pamoja na matukio ya hivi karibuni.
- ✅ **Ufunguzi wa Duka** — onyesho la stock ya asubuhi (soma-tu, kwani
  inatoka moja kwa moja kwenye Closing ya jana, kama proposal inavyoeleza).
- ✅ **Ufungaji wa Siku** — fomu inayofanya kazi: msimamizi anaingiza Physical
  Count, mfumo unahesabu Variance wenyewe, unahitaji sababu pale kuna tofauti,
  na "unafunga" ripoti baada ya kuwasilisha (hairudiwi kubadilika).
- 🔜 Upokeaji wa Stock, Upatanisho wa Fedha, Omba Stock, na Matumizi —
  skeleton za moduli hizi zipo (navigation + UI ya msingi), tayari kwa fomu
  kamili na muunganiko wa backend katika hatua inayofuata.

Data yote ya sasa ni **mock data** (`src/data/mock.ts` na ndani ya screens) —
bado hakuna muunganiko na backend halisi (Node.js/NestJS au Django + Postgres,
kama ilivyoainishwa Sehemu ya 9 ya proposal).

## Muundo wa Folda

```
NeoSmartCore/
├── App.tsx                     # Entry: fonts, native splash, animated splash → navigator
├── index.js
├── app.json                    # Usanidi wa Expo (icon, splash, jina la app)
├── assets/                     # Icons zilizotolewa (1024px + transparent)
└── src/
    ├── theme/theme.ts          # Rangi/fonti kutoka Sehemu 12 ya proposal
    ├── data/mock.ts            # Data ya mfano
    ├── navigation/RootNavigator.tsx
    ├── components/             # ActionCard, StatusPill, ModuleHeader, ComingSoonModule
    └── screens/
        ├── SplashScreen.tsx        # Animation ya logo
        ├── HomeScreen.tsx          # Dashboard ya Msimamizi
        ├── DailyOpeningScreen.tsx
        ├── DailyClosingScreen.tsx
        ├── StockReceivingScreen.tsx
        ├── CashReconciliationScreen.tsx
        ├── StockRequestScreen.tsx
        └── ExpensesScreen.tsx
```

## Jinsi ya Kuiendesha

Inahitaji Node.js 20+ na Expo Go (au dev build) kwenye simu/tablet, au
simulator ya Android/iOS.

```bash
npm install
npx expo install --fix   # inahakikisha version za packages zinaendana kikamilifu na SDK 57
npx expo start
```

Kisha scan QR code na Expo Go, au bonyeza `a` kwa Android emulator / `i` kwa
iOS simulator.

> **Kwa nini SDK 56 badala ya 57?** Wakati wa kutengeneza toleo hili, Expo SDK
> 57 (57.0.20) ina **bug ya kudumu inayojulikana** kwenye
> `@expo/metro-config` (serializer ya "packed source maps") inayosababisha
> `TypeError: Cannot read properties of undefined (reading 'transformFile')`
> wakati wa bundling na Expo Go — imeripotiwa rasmi kwenye
> [expo/expo#48594](https://github.com/expo/expo/issues/48594) na bado
> haijatatuliwa kikamilifu. SDK 56 (iliyotangulia, thabiti) haina bug hii.
> SDK 56 ina regression ndogo ya hivi karibuni inayohusu `react-native-
> reanimated`/`react-native-worklets` pekee — app hii haitumii maktaba hizo,
> kwa hiyo salama. Mara Expo watakapotoa patch ya SDK 57, unaweza kupandisha
> kwa amri `npx expo install expo@^57 --fix`.
>
> Pakiti zote zinazosimamiwa na Expo (zile zenye jina `expo-*`, pamoja na
> `react-native-screens` na `react-native-safe-area-context`) zimewekwa bila
> version maalum kwenye `package.json` — hii ni kwa makusudi. Amri ya
> `npx expo install --fix` (inayoendeshwa moja kwa moja baada ya
> `npm install` kupitia `postinstall`) ndiyo itakayoweka version sahihi
> zinazoendana kikamilifu na `expo@~56.0.15` iliyowekwa.

## Safe Area

Kila screen inatumia `react-native-safe-area-context` (`SafeAreaProvider` +
`SafeAreaView`/`useSafeAreaInsets`) ili maudhui yasiguswe na notch, status bar,
au home indicator — header za rangi (navy→sky gradient) zinaenea nyuma ya
status bar kwa muonekano wa kisasa (edge-to-edge), huku maandishi na vitufe
vikibaki ndani ya eneo salama.

## Hatua Zinazofuata (zilizopendekezwa)

1. Unganisha Authentication (login ya Branch Manager kwa namba ya simu +
   password, kulingana na entity ya `USERS`).
2. Jenga fomu kamili za Upokeaji wa Stock, Upatanisho wa Fedha, Omba Stock na
   Matumizi (zote zina muundo wa UI tayari — zinahitaji tu kuunganishwa na
   API halisi).
3. Ongeza Offline-first (SQLite + sync) kama ilivyoainishwa Sehemu ya 8 ya
   proposal.
4. Ongeza Push Notifications (Firebase Cloud Messaging) kwa arifa za stock ya
   chini na variance.
