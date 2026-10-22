# Monkey Mart — transport multiplayer (wersja robocza)

Niezależny kod serwera WebSocket do późniejszej integracji z oryginalnym Defold/Lua.
**To nie jest jeszcze grywalna wersja Monkey Mart.** Nie zawiera skopiowanych skryptów
ani grafik i nie podmienia oryginalnej rozgrywki.

## Obsługiwane

- Pokoje do 4 osób z unikatowymi kodami.
- Dołączanie w trakcie i synchronizacja pozycji / wyglądu (`monkey1`–`monkey17`).
- Rozłączanie graczy i usuwanie pustych pokoi.
- Odrzucanie przestarzałych wiadomości o ruchu (sequence number).
- Testy jednostkowe i smoke test serwera w GitHub Actions.

## Brakujące prace

- Integracja protokołu z istniejącym `GameState.lua` i postaciami Defold.
- Odtworzenie zasobów Defold i kompilowalnego, oryginalnego projektu.
- Synchronizacja klientów, sklepu, produktów, pieniędzy, klientów i NPC.
- Serwer autorytatywny dla interakcji, walidacja kolizji, bezpieczeństwo, TLS i zapis gry.

## Lokalny start (opcjonalnie)

Wejdź do folderu `multiplayer/server`, uruchom `npm install`, a następnie
`node server.js`. Serwer deweloperski nasłuchuje na `127.0.0.1:8080`.

## Wiadomości JSON WebSocket

- `{"type":"create","name":"Gracz 1","skin":"monkey1"}`
- `{"type":"join","room":"ABC123","name":"Gracz 2","skin":"monkey2"}`
- `{"type":"move","x":100,"y":200,"seq":1}`
- `{"type":"skin","skin":"monkey4"}`
- `{"type":"snapshot"}`

Odpowiedzi: `welcome` z kodem pokoju, własnym ID i stanem graczy;
`player_joined`, `player_left`, `player_moved`, `player_skin` i `error`.

Ważne: przesyłanie współrzędnych nie oznacza jeszcze autorytatywnej symulacji
rozgrywki. Stan sklepu musi być synchronizowany osobno.

## Synchronizacja zapasów (etap eksperymentalny)

Serwer wspiera teraz **autorytatywne** przenoszenie towarów między wspólnym magazynem a ekwipunkiem graczy: walidowane komunikaty `action` (`collect`/`drop`) z `requestId`, monotoniczną wersję stanu `revision`, odrzucanie niedostępnych towarów, bezpieczne ponawianie i zwrot niesprzedanych towarów przy rozłączeniu. Nowi gracze dostają `store` i `players[].inventory` w `welcome`/`snapshot`.

Zaufana część serwera musi skonfigurować katalog i stan początkowy przez `startServer({ initialStock: { banana: 10 } })`; **klienci nie mogą tworzyć towarów ani pieniędzy**. Bez tej konfiguracji zapasy są puste. Katalog produktów i wartości ekonomiczne wciąż muszą zostać powiązane z oryginalnym `GameState.lua`; to jeszcze nie jest pełna logika sprzedaży Monkey Mart.

Przykładowe żądanie: `{"type":"action","action":"collect","item":"banana","quantity":1,"requestId":"collect-42"}`.
Serwer odpowiada `action_result`, a pozostałym klientom wysyła `store_changed`; po rozłączeniu może wysłać `store_snapshot`. Serwer nadal nie waliduje odległości gracza od towaru, animacji, klientów, cen ani kolizji. Nie należy wykorzystywać tego jako gotowego mechanizmu zapobiegającego oszustwom.

## Autorytatywna wspólna kasa i jednorazowe ulepszenia (prototyp)

Zaufana konfiguracja serwera może ustawić `startServer({
  initialBalance: 100, upgradePrices: { shelf: 30, machine: 60 }
})`.
Domyślnie saldo wynosi 0, a katalog ulepszeń jest pusty. Tylko serwer ustala
saldo początkowe i ceny. Klient nie może dopisać pieniędzy ani zmienić ceny.
Maksymalnie 64 różne ulepszenia, każde można kupić **raz na pokój**.

Wiadomość klienta: `{"type":"purchase","upgrade":"shelf","requestId":"buy-1"}`.
Kupujący dostaje `purchase_result` z ceną, saldem, rewizją i flagą `duplicate`;
pozostali otrzymują `economy_changed`. `welcome` i `snapshot` zawierają
`economy: {revision,balance,upgradePrices,purchasedUpgrades}`. Powtórzenie
udanego żądania nie wydaje pieniędzy drugi raz; przy jednoczesnych zakupach
serwer odrzuca drugi zakup już wykupionego ulepszenia lub zakup bez środków.
Lua bridge udostępnia `client:purchase("shelf")`.

**Ograniczenia:** brak zarabiania, cen oryginalnej gry, głosowania nad zakupami,
trwałego zapisu, uprawnień graczy i integracji z oryginalną rozgrywką. Ten kod
to samodzielny prototyp protokołu i ekonomii, a nie gotowa gra.
