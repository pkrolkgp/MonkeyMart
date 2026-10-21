# Monkey Mart CO-OP — plan projektu (wersja 0.4)

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
| M09 | Zamówienia specjalne: wspólne realizowanie zamówień na czas | później | zatwierdzone |
| M10 | Kombinacje pracy: zbieraj → przenieś → wyłóż → sprzedaj | później | pomysł |
| M11 | Nagły tłum klientów / awaria urządzenia / duża dostawa | później | pomysł |
| M12 | Wspólne decyzje: głosowanie nad dużymi ulepszeniami | później | zatwierdzone |
| M13 | Dołączanie w trakcie gry: nowy gracz dostaje aktualny stan sklepu | później | zatwierdzone |
| M14 | Powrót do sesji po zerwaniu połączenia | później | pomysł |
| M15 | Wyścig zespołu z dziennymi celami — bez rywalizacji między graczami | później | pomysł |
| M16 | LAN w sieci domowej bez usługi zewnętrznej | później | pomysł |
| M17 | Gra solo offline z lokalnym zapisem | MVP | pomysł |
| M18 | Własne małpki: wybór koloru i wyglądu postaci | później | zatwierdzone |

### Szczegóły zasad

- **Pieniądze:** jeden licznik dla sklepu. Zakup zatwierdza serwer/host, aby dwóch graczy nie wydało jednocześnie tych samych środków.
- **Towary:** ten sam produkt nie może być zebrany dwa razy; stan upraw, przenoszonych przedmiotów i regałów jest wspólny.
- **Pracownicy NPC:** zachowujemy możliwość automatyzacji pracy, ale kooperacja graczy ma być użyteczna.
- **Brak gracza:** pozostali pracują dalej. Połączenie zerwane nie powinno psuć stanu sklepu.
- **Zakupy:** na start każdy może robić zwykłe zakupy; zatwierdzono głosowanie nad dużymi ulepszeniami (M12). Próg cenowy i reguły głosowania pozostają do ustalenia.

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
- [x] Czy do wspólnych dużych zakupów wymagamy głosowania? **Tak (M12).**
- [ ] Ustalić próg „dużego zakupu” i liczbę wymaganych głosów.
- [ ] Czy pojawiają się przeszkody i wydarzenia losowe?
- [ ] Czy rozgrywka powinna dać się uruchomić z samego folderu offline (solo) bez instalacji?

## 7. Zatwierdzone pomysły (21.10.2026)

- **M09 – Zamówienia specjalne:** drużyna wspólnie przygotowuje większe zamówienie określonych produktów przed upływem czasu; premie trafiają do wspólnej kasy.
- **M12 – Wspólne decyzje:** większe inwestycje sklepu wymagają głosowania aktywnych graczy; reguły głosowania i próg ceny ustalimy w trakcie projektowania.
- **M13 – Dołączanie w trakcie:** znajomy podaje kod pokoju i dołącza do trwającej rozgrywki, otrzymując aktualny stan mapy, produktów i pieniędzy; maksymalnie cztery osoby.
- **M18 – Własne małpki:** każdy gracz wybiera własny kolor i wygląd postaci, aby małpki były rozróżnialne.

## 8. Techniczne rozpoznanie odzyskiwania projektu Defold

W aktualnym repozytorium znajduje się **build HTML5**, a nie oryginalny edytowalny projekt gry. Jego dane są w `archive/game.arcd0`, `game.arcd1`, `game.arcd2` z indeksem `archive/game.arci0` i manifestem `archive/game.dmanifest0`.

- Najpierw: sprawdzić, czy można legalnie otrzymać źródła gry lub pozwolenie na modyfikacje.
- Jeśli możliwe jest techniczne badanie builda: scalić fragmenty archiwum (`cat game.arcd0 game.arcd1 game.arcd2 > game.arcd`), skopiować `game.arci0` jako `game.arci`, `game.dmanifest0` jako `game.dmanifest` i spróbować rozpakować narzędziem **arcdEx**.
- Zidentyfikować odzyskane pliki `.luac` i sprawdzić, czy zawierają źródła Lua (starsze buildy WWW Defold mogły je zawierać) czy kod bajtowy wymagający dekompilacji. Odtworzenie projektu edytowalnego nie jest gwarantowane.
- Sprawdzić sceny, obiekty, zasoby, działanie zasobów z licencją oraz możliwość przebudowy za pomocą Defold. Nie zamieniać samego `MonkeyMart.wasm` na domniemane źródła gry — to przede wszystkim skompilowany silnik.
- Po odzyskaniu praw i źródeł: przeanalizować stan sklepu, transakcje, ruch postaci i wykonać prototyp sieciowy na kopii/projekcie roboczym. W przeciwnym razie rozwijać własną oryginalną grę CO-OP.

## 9. NOWE POMYSŁY — dopisuj tutaj

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
**Zasada aktualizacji:** dodajemy nowe propozycje do sekcji 9, omawiamy je, zatwierdzone przenosimy do tabeli mechanik i odpowiedniego etapu. Ten plik jest żywym planem.


## 10. Audyt odzyskanego kodu — 21 października 2026

**Status:** użytkownik odzyskał i przekazał archiwum `extracted_fixed`. Potwierdzono 50 czytelnych plików `.lua`, 15 `.script` oraz 10 `.gui_script`. **To nie jest jeszcze odbudowany, kompilowalny projekt Defold ani gotowy multiplayer.** Pełniejsze ustalenia zawiera prywatny raport analizy wykonany na przesłanym archiwum; oryginalnych odzyskanych źródeł nie umieszczamy publicznie bez wyjaśnienia praw.

### Fakty potwierdzone analizą

- `main/gamecore/GameState.lua` (7638 linii): wspólny punkt obsługi stanu sklepu, produktów, zakupów i kolejki klientów.
- `main/gamecore/Player.lua` (1526 linii): logika postaci, ruchu, ekwipunku oraz NPC.
- `GameState:addPlayer(vId, vX, vY, vData)` już potrafi tworzyć postacie z osobnym ID, ale większość istniejących postaci to **NPC**, a nie gracze sieciowi.
- Lokalna małpka ma ID `idMy`, a `GameState.controlId` steruje kamerą i wejściem. Trzeba wydzielić niezależne ID gracza na każdym kliencie.
- `GameState:collectFood` i `dropFood` zmieniają towary lokalnie; docelowo serwer musi zatwierdzać pojedynczą transakcję, zapobiegając duplikacji.
- `GameState:placeCheckBuy` i `coinmanager.lua` pobierają pieniądze lokalnie; saldo i głosowania M12 wymagają autorytatywnego stanu pokoju.
- `datamanager.lua` używa lokalnych zapisów Defold `defsave`; multiplayer potrzebuje osobnego zapisu wspólnego sklepu.
- `main/gamecore/dodik.script` stosuje `spine.set_skin`; zdekodowany `images/spine/monkeys.spinejsonc` zawiera 17 nazwanych skinów `monkey1`–`monkey17` — przydatne dla M18.
- Pliki `.collectionc`, `.goc`, `.guic`, tekstury oraz pozostałe zależności są nadal materiałami skompilowanymi. Przed modyfikacjami sieciowymi trzeba odtworzyć oryginalne sceny/zasoby lub uzyskać oryginalny projekt i **uruchomić niezmienioną wersję z Defold Editora**.

### Najbliższe zadania, wynikające z audytu

- [ ] Ustalić uprawnienia do modyfikacji i ewentualnej publikacji kodu/zasobów.
- [ ] Odzyskać edytowalną scenę jednego sklepu wraz z atlasami, Spine, wejściem i konfiguracją; uruchomić działającą wersję offline w Defold Editorze.
- [ ] Oddzielić lokalne wejście, prezentację, symulację świata i trwały zapis.
- [ ] Zidentyfikować wszystkie mutacje stanów pieniędzy, regałów, ekwipunków i zakupów; dodać jedną warstwę walidacji transakcji.
- [ ] Uruchomić 2 niezależnie sterowane postacie na jednej mapie bez internetu jako test podstawy multiplayer.
- [ ] Dodać pokoje WebSocket, autorytatywny serwer oraz synchronizację ruchu i transakcji.
- [ ] Rozszerzyć do 4 graczy, dołączania w trakcie (M13), oddzielnych skinów (M18) i zapisu postępu.
- [ ] Zrealizować M09 (zamówienia specjalne) i M12 (głosowania) po ustabilizowaniu wspólnej ekonomii.

**Uwaga:** obecne założenia silnika/architektury w sekcji 5 były propozycją sprzed odzyskania Lua. Po audycie pierwszą opcją jest odbudowa projektu **Defold + Lua**. Wariant nowego autorskiego projektu Phaser/TypeScript pozostaje alternatywą, jeśli odbudowa lub uzyskanie praw nie okażą się możliwe.


## 11. Podjęta decyzja: rozwój oryginalnej gry, nie nowy klon (21.10.2026)

**Wymaganie użytkownika:** wykorzystać maksymalnie cały istniejący kod i zasoby Monkey Mart, odzyskać edytowalny projekt Defold, a następnie **dodać jedynie funkcje kooperacji 1–4 graczy**. Nie zastępować oryginalnej gry nową implementacją Phaser ani grafikami zastępczymi. Dotychczasowy `coop_stage1` jest wyłącznie techniczną makietą do testowania niezależnego sterowania, a nie docelową grą.

### Aktualny stan

- Otrzymano archiwum z wyodrębnionymi zasobami Defold: 50 plików `.lua`, 15 `.script`, 10 `.gui_script`, 1 `.render_script`, 19 `.collectionc`, 135 `.goc` i 5 `.texturec`.
- Kod Lua oraz skrypty zdarzeń są odzyskane w czytelnej formie; część scen, obiektów, atlasów, GUI, animacji Spine i zależności ma nadal format skompilowany.
- Import 76 plików Lua/skryptów do `MonkeyMart-COOP` zakończył się powodzeniem.
- Gra startuje w technicznej scenie testowej z dwoma prostokątnymi znacznikami postaci. **Odtworzenie oryginalnego sklepu nadal nie jest ukończone.**

### Nowa kolejność działań (zastępuje sugestie przepisywania gry od podstaw)

- [ ] Potwierdzić uprawnienia do używania, modyfikowania i — jeśli planowana — redystrybucji oryginalnej gry i jej zasobów. Monkey Mart jest autorstwa TinyDobbins; publiczna dostępność plików nie daje automatycznie licencji.
- [ ] Przenieść odzyskane źródła do repozytorium z odpowiednim dostępem **tylko po potwierdzeniu uprawnień**; nie publikować odzyskanego kodu w obecnym publicznym repo bez takiego potwierdzenia.
- [ ] Odzyskać edytowalne sceny (`.collection`), obiekty (`.go`), GUI (`.gui`), atlasy i Spine w istniejących ścieżkach zależności.
- [ ] Podpiąć odtworzony `game.project`, render, wejście, skrypty i zasoby; uzyskać build offline o wyglądzie i mechanice oryginału.
- [ ] Zweryfikować zachowanie oryginału: ruch, zbiór towarów, klient, kasa, ulepszenia, NPC, animacje i zapisy.
- [ ] Dodać drugą, następnie cztery **prawdziwe** postacie graczy bez zmiany podstawowych mechanik sklepu.
- [ ] Wprowadzić autorytatywny stan pokoju i sieciową synchronizację ruchu, towarów, transakcji oraz zapisu, z dołączaniem w trakcie.
- [ ] Dodać zatwierdzone funkcje M09, M12, M13, M18 na bazie już działającej gry.

**Defold + Lua pozostaje docelowym silnikiem.** Nie deklarujemy, że pełne odtworzenie ze skompilowanego builda jest gwarantowane.

## 12. Postęp konwersji protobuf (21 października 2026)

- [x] Rozpakowanie oryginalnego archiwum Defold.
- [x] Odzyskanie 76 skryptów i modułów (50 `.lua`, 15 `.script`, 10 `.gui_script`, 1 `.render_script`).
- [x] Wstępna tekstowa konwersja 303 zasobów protobuf.
- [x] Poprawa definicji `dmSoundDDF.SoundDesc` oraz `dmCollectionProxyDDF.CollectionProxyDesc` — **29 dodatkowych plików, 0 zgłoszonych błędów**.
- [ ] Audyt wszystkich **332 kandydatów** do edycji: ścieżki, referencje, pola tylko dla runtime, powiązania między obiektami.
- [ ] Odbudowa atlasów, materiałów, scen Spine i pozostałych zależności.
- [ ] Zweryfikowanie czytelności w Defold Editorze oraz uruchomienie **oryginalnej** mechaniki offline.
- [ ] Dopiero potem dodanie współdzielonego stanu sklepu i multiplayer 1–4 graczy.

**Uwaga:** zero błędów dekodowania oznacza poprawną operację protobuf, a nie poprawność plików z punktu widzenia Defold Edytora. Źródła odzyskane z oryginalnej gry nie są publikowane w repozytorium bez ustalenia odpowiednich praw.


## 13. Audyt przesłanego projektu edytowalnego (22.10.2026)

Użytkownik dostarczył `MonkeyMart-edytowalny.zip`. Przeprowadzono kontrolę zawartości odzyskanego projektu Defold i przygotowano lokalną, **jeszcze niekompilowalną** kopię roboczą bez zastępowania oryginalnej rozgrywki atrapami.

- [x] Zidentyfikowano 19 scen `.collection`, 135 obiektów `.go`, 10 interfejsów `.gui` i 115 komponentów `.sprite`.
- [x] Usunięto z kopii roboczej 47 bloków `component_types` i 209 bloków `property_decls` będących polami runtime-only.
- [x] Skorygowano 128 referencji wbudowanych materiałów z `.materialc` do `.material`.
- [x] Ustawiono rozpoznaną oryginalną scenę startową `/main/controller.collection` w testowym `game.project` (tylko do dalszej walidacji).
- [ ] **18 różnych odwołań do zasobów nadal nierozwiązanych**, w tym pięć skompilowanych atlasów `.texturesetc`, pięć modeli Spine, oryginalna czcionka i brakujące kolekcje.
- [ ] Odtworzyć atlasy z istniejących `.texturec`/`.texturesetc`, zachowując nazwy oryginalnych animacji; uwzględnić wersję formatu używaną w odzyskanym buildzie.
- [ ] Zweryfikować pełne obrazy Spine (oryginalny plik `.spinejson` deklaruje wersję **4.1.24**, a współczesne rozszerzenie może używać Spine 4.2) i odzyskać brakujące kolekcje.
- [ ] Uruchomić budowę projektu i dopiero wtedy rozpocząć integrację multiplayer.

**Zasada:** kod i zasoby oryginalnej gry pozostają wyłącznie w lokalnych/prywatnych artefaktach; w publicznym GitHubie zapisujemy tylko plan i własne narzędzia po wyjaśnieniu praw do zasobów.


## 14. Automatyzacja i transport multiplayer (22 października 2026)

- [x] Naprawiono GitHub Actions: dwa zaszyfrowane skrypty debug w `resources.zip` są teraz zgłaszane jako **niezweryfikowane** zamiast błędów. [Udany audyt](https://github.com/pkrolkgp/MonkeyMart/actions/runs/39688707264). 33 zasoby zweryfikowane, dwa zaszyfrowane, 7 z 18 brakujących zależności odnalezionych.
- [x] Własny, niezależny od kodu oryginalnej gry transport `multiplayer/server`: pokoje do 4 osób, dołączanie w trakcie, snapshot pozycji i skinów, ruch z numerami sekwencyjnymi, obsługa rozłączeń.
- [x] Testy jednostkowe i rzeczywisty test połączeń WebSocket (utworzenie pokoju, dołączenie, ruch, piąty gracz odrzucony). [Zielone GitHub Actions](https://github.com/pkrolkgp/MonkeyMart/actions/runs/39689378915).
- [ ] Główna blokada: wciąż brak kompilowalnego źródłowego projektu Defold po odzyskaniu oryginalnej gry. Część atlasów, Spine i kod pomocniczy wymagają odbudowy.
- [ ] Połączyć transport z istniejącymi `GameState.lua` i `Player.lua` oraz stworzyć serwer autorytatywny dla towarów, gotówki, klientów i zakupów.
- [ ] Testy użytkowe oraz dopiero po nich udostępnienie wersji multiplayer do pobrania.

Nie uznawać zielonego audytu ani testów transportu za ukończoną grę. Nie ma jeszcze instalatora/buildu gry multiplayer.
