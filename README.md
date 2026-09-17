# Peshka

Digitalni dnevnik ulova za sportske ribolovce.

## Projekt

| | |
|---|---|
| Ustanova | [Fakultet informatike u Puli](https://fipu.unipu.hr) |
| Kolegij | [Programsko inženjerstvo](https://ntankovic.unipu.hr/pi) |
| Mentor | [doc. dr. sc. Nikola Tanković](https://ntankovic.unipu.hr) |

## Tim

Erik Fakin - samostalan rad na cijelom projektu.

## Što aplikacija radi

Ribolovac zabilježi **izlazak** (datum, vrijeme polaska i povratka, polazište i
područje lova na karti), a zatim mu dodaje pojedinačne **ulove**. Uz svaki ulov
spremaju se uvjeti koji su u tom satu vladali na moru, pa se kasnije može
usporediti što je zapravo radilo.

| Područje | Što obuhvaća |
|---|---|
| Izlasci | Unos, uređivanje i brisanje izlaska, popis po godinama, zbroj ulovljenog i puštenog |
| Ulovi | Vrsta ribe, način lova, mamac, duljina, masa, puštena riba |
| Karta | Odabir lokacije pribadačom, karta javnih ulova na naslovnici (Leaflet, OpenStreetMap) |
| Fotografije | Smanjivanje na 1600 px u pregledniku pa upload u Firebase Storage |
| Uvjeti | Vjetar, stanje mora, temperature i tlak s Open-Meteo, trend tlaka i plime |
| Mjesec i sunce | Mjesečeva mijena i zora/sumrak u trenutku ulova (SunCalc) |
| Analitika | Ulovi po vrsti, načinu, mamcu, dijelu dana i mijeni; uvjeti mjereni kao ulova po izlasku |
| Javni dio | Stranica ulova s komentarima, profil ribolovca, vidljivost javno/privatno |
| Firebase | Authentication, Firestore, Storage i sigurnosna pravila |

## Tehnologije

Vue 3 (`<script setup>`), Vite, Vue Router, Pinia, Tailwind CSS i
[shadcn-vue](https://www.shadcn-vue.com) (komponente u `src/components/ui/`,
građene na reka-ui), Firebase (Auth, Firestore, Storage). Vanjski servisi:
Open-Meteo za prognozu i stanje mora, Nominatim za naziv mjesta iz koordinata.

## Pokretanje

### 1. Firebase projekt

U [Firebase konzoli](https://console.firebase.google.com) stvorite projekt i u
njemu uključite:

- **Authentication** s prijavom putem e-maila i lozinke
- **Cloud Firestore**
- **Storage**

Zatim dodajte web aplikaciju (Project settings → General → Your apps).

### 2. Konfiguracija

Kopirajte `.env.example` u `.env` i upišite vrijednosti iz konfiguracije web
aplikacije:

```sh
cp .env.example .env
```


### 3. Šifrarnici

Vrste ribe, načini lova i mamci ne unose se iz aplikacije, nego ručno u
Firestore konzoli. Bez njih su padajući izbornici u formi ulova prazni.
Id dokumenta može biti automatski.

| Kolekcija | Polja | Primjer |
|---|---|---|
| `vrsteRibe` | `nazivHr`, `nazivLat` | `Zubatac`, `Dentex dentex` |
| `naciniLova` | `naziv` | `Spinning` |
| `mamci` | `naziv`, `tip` | `Rapala X-Rap`, `Vobler` |

### 4. Pokretanje

```sh
npm install
npm run dev
```

Build za produkciju:

```sh
npm run build
```

Provjera koda:

```sh
npm run lint
```
