# Skulemusikken

En enkel, mobiltilpasset oversiktsapp for Samnanger skulemusikklag.

## Første mål

Appen skal gjøre det raskt å se:

- neste øving/aktivitet
- hvem som har vakt i Hovedkorps, Juniorkorps og Aspirantkorps
- hvem fra styret som har styrevakt
- terminliste
- viktig informasjon som må være lett å finne igjen

## Faste øvingstider

- **Hovedkorps:** torsdag 17:30–19:45
- **Juniorkorps:** torsdag 17:00–18:30
- **Aspirantkorps:** torsdag 17:30–18:30

## Personvern

Repoet er per nå offentlig. Personnavn fra vaktlister skal derfor ikke legges inn i kildekoden. Før vi legger inn den faktiske vaktlisten bør repoet gjøres privat, eller persondata flyttes til en privat datakilde/backend.

## Struktur

Første versjon er en statisk webapp som kan utvides trinnvis. Data er skilt fra visningen slik at vi senere kan koble på Firebase, Tutti-kalender, varsler og import av terminlister uten å bygge appen på nytt.
