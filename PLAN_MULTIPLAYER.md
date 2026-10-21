# Monkey Mart CO-OP — plan projektu (wersja 0.1)

> **Status:** koncepcja. To plan, nie gotowa implementacja multiplayer.
> **Główna idea:** od 1 do 4 graczy wspólnie prowadzi **jeden sklep**, współdzieli pieniądze, stany magazynowe, maszyny, klientów i ulepszenia.

## 1. Założenia

- Gra przeglądarkowa działająca na macOS i innych komputerach.
- Maksymalnie czterech graczy jednocześnie; jedna wspólna mapa sklepu.
- Możliwość zabawy solo bez internetu i bez reklam.
- Dla multiplayer: docelowo LAN i internet (kod pokoju); każdy gracz ma oddzielną postać.
- Każdy może wykonać dowolne zadanie — brak przymusowych klas lub przydzielonych zawodów.
- Wspólny zapis rozwoju sklepu i wspólna kasa.
- Przyjazny, prosty styl rozgrywki, bez presji rywalizacji.

## 2. Co wiemy o istniejącym repozytorium?

Repo zawiera pliki skompilowanej gry Defold: m.in. `MonkeyMart.wasm`, `MonkeyMart_wasm.js`, `dmloader.js`, `archive/game.arcd*`, `archive/game.arci0` oraz `index.html`. Nie ma tu widocznych plików źródłowych `.script` i projektowych `.collection` do edycji rozgrywki.

**Wniosek:** nie zakładamy, że da się dodać prawdziwy multiplayer samym JS-em w stronie. Najpierw trzeba ustalić możliwość uzyskania oryginalnych źródeł i prawa do ich zmiany. Jeśli są niedostępne: tworzymy osobną, oryginalną grę inspirowaną mechaniką kooperacyjnego sklepu, z własnym kodem i grafiką/licencjami. Nie nadpisujemy istniejącej gry.

## 3. Mechaniki multiplayer (propozycje)

| ID | Funkcja | Priorytet | Stan |
|---|---|---|---|
| M01 | 1–4 postacie w jednym sklepie | MVP | pomysł |
| M02 | Wspólne pieniądze, produkty, klienci i poziom sklepu | MVP | pomysł |
| M03 | Dowolny podział obowiązków między graczy | MVP | pomysł |
| M04 | Pokój z kodem: utwórz/dołącz | MVP | pomysł |
| M05 | Synchronizacja zbierania, noszenia i odkładania towaru | MVP | pomysł |
| M06 | Wspólny zakup ulepszeń bez podwójnego wydawania środków | MVP | pomysł |
| M07 | Zapis i odtworzenie postępu sklepu | MVP | pomysł |
| M08 | Krótkie emotki i sygnał „potrzebuję pomocy” | później | pomysł |
| M09 | Dostawy ekspresowe na czas: wspólne realizowanie zamówienia | później | pomysł |
| M10 | Kombinacje pracy: zbieraj → przenieś → wyłóż → sprzedaj | później | pomysł |
| M11 | Nagły tłum klientów / awaria urządzenia / duża dostawa | później | pomysł |
| M12 | Głosowanie nad dużymi ulepszeniami | do decyzji | pomysł |
| M13 | Wejście kolejnego gracza podczas rozgrywki | później | pomysł |
| M14 | Powrót do sesji po zerwaniu połączenia | później | pomysł |
| M15 | Wyścig zespołu z dziennymi celami — bez rywalizacji między graczami | później | pomysł |
| M16 | LAN w sieci domowej bez usługi zewnętrznej | później | pomysł |
| M17 | Gra solo offline z lokalnym zapisem | MVP | pomysł |
| M18 | Personalizacja koloru i stroju małpek | później | pomysł |

### Szczegóły zasad

- **Pieniądze:** jeden licznik dla sklepu. Zakup zatwierdza serwer/host, aby dwóch graczy nie wydało jednocześnie tych samych środków.
- **Towary:** ten sam produkt nie może być zebrany dwa razy; stan upraw, przenoszonych przedmiotów i regałów jest wspólny.
- **Pracownicy NPC:** zachowujemy możliwość automatyzacji pracy, ale kooperacja graczy ma być użyteczna.
- **Brak gracza:** pozostali pracują dalej. Połączenie zerwane nie powinno psuć stanu sklepu.
- **Zakupy:** na start każdy może kupować; głosowanie nad droższymi rozbudowami jest pomysłem do dyskusji.

## 4. Kolejność wdrażania

### Etap A — decyzje i prototyp
- [ ] Ustalić prawo do źródeł i zasobów.
- [ ] Wybrać silnik: Defold (jeśli mamy źródła) albo np. Phaser + TypeScript (nowa oryginalna gra).
- [ ] Uruchomić pustą scenę sklepu i jedną sterowaną postać.
- [ ] Dodać drugą postać i ruch przez lokalny serwer WebSocket.

### Etap B — minimalny multiplayer (MVP)
- [ ] Pokój dla 1–4 osób z kodem dołączenia.
- [ ] Ruch i pozycja graczy bez przeskoków; identyfikatory graczy.
- [ ] Jeden regał, jedna uprawa i jeden klient, zsynchronizowane na serwerze.
- [ ] Jedno wspólne saldo i jeden rodzaj ulepszenia.
- [ ] Zabezpieczyć akcje przed powieleniem przy lagach / jednoczesnych kliknięciach.
- [ ] Test 4 przeglądarek oraz rozłączania graczy.

### Etap C — pełna pętla rozgrywki
- [ ] Więcej towarów, produkcja i pracownicy NPC.
- [ ] Rozbudowa sklepu, zapis postępu i powrót do rozgrywki.
- [ ] Balans ekonomii dla 1, 2, 3 i 4 graczy.
- [ ] Sterowanie przyjazne dzieciom i responsywny interfejs.

### Etap D — funkcje społeczne
- [ ] Emotki, pingi i wspólne wyzwania.
- [ ] Dołączanie w trakcie i odzyskanie połączenia.
- [ ] Opcjonalne wydarzenia specjalne.
- [ ] Dopracowanie LAN, internetu i trybu solo offline.

## 5. Proponowana architektura (gdy tworzymy nowy projekt)

- Klient: **Phaser + TypeScript** (przeglądarka; opcjonalnie PWA dla gry solo offline).
- Serwer sesji: **Node.js + WebSocket**; serwer decyduje o pieniądzach, produktach, klientach i ulepszeniach.
- Stan pokoju: unikalny kod, do 4 identyfikatorów graczy, sklep i jego ekwipunek.
- Zapis: początkowo plik JSON lub SQLite na serwerze; gra solo zapisuje lokalnie.
- Sieć: komendy gracza → walidacja na serwerze → aktualizacja stanu do wszystkich; interpolacja ruchu klienta.
- Prywatność: pokoje po kodzie, prosta kontrola gospodarza; na początku bez kont, reklam i czatu tekstowego.

## 6. Otwarte decyzje

- [ ] Czy dopuszczamy też **4 graczy przy jednym komputerze** (wspólna klawiatura/pady)?
- [ ] Czy właściciel sklepu jest jeden, czy cały zespół może wznawiać zapis?
- [ ] Czy zapisy mają działać między różnymi urządzeniami?
- [ ] Czy do wspólnych dużych zakupów wymagamy głosowania?
- [ ] Czy pojawiają się przeszkody i wydarzenia losowe?
- [ ] Czy rozgrywka powinna dać się uruchomić z samego folderu offline (solo) bez instalacji?

## 7. NOWE POMYSŁY — dopisuj tutaj

Skopiuj wiersz i zmień opis. Pomysły wcale nie muszą być techniczne.

| Nr | Twój pomysł | Priorytet | Status |
|---|---|---|---|
| P01 | *(wpisz pierwszy nowy pomysł)* | do ustalenia | do dyskusji |

### Prosty szablon pomysłu

**Nazwa:**  
**Co robi gracz:**  
**Jak pomaga współpracy:**  
**Czy potrzebne w pierwszej wersji:** tak / nie / nie wiem

---
**Zasada aktualizacji:** dodajemy nowe propozycje do sekcji 7, omawiamy je, zatwierdzone przenosimy do tabeli mechanik i odpowiedniego etapu. Ten plik jest żywym planem.
