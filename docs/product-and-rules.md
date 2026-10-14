# Das fiktive Produkt und seine Regeln

RaumPilot ist eine erfundene B2B-Software. Unternehmen fragen Tagungsräume bei mehreren Hotels an, vergleichen Angebote und verfolgen den Buchungsfortschritt. Alle Regeln gelten nur für diese Demo und sind keine Aussagen über Meetago oder reale Buchungsverträge.

## Ein konkreter Fall

Lena arbeitet für Nordlicht Consulting. Sie organisiert ein Seminar und erstellt die Anfrage RFP-1042. Fünf Hotels wurden angefragt. Zwei Rückmeldungen sind eingegangen, werden aber noch geprüft und sind für Lena noch nicht sichtbar.

Lena fragt: „Wann bekomme ich die Angebote?“ Der Support muss unterscheiden: Gibt es noch keine Rückmeldung, oder ist eine Rückmeldung vorhanden, die noch nicht freigegeben ist? Das steht im aktuellen Vorgang, nicht im Hilfeartikel.

## Verbindliche Demo-Regeln

- Eine angelegte Anfrage ist keine Buchung.
- Eine Angebotsübersicht ist keine Buchungsbestätigung.
- Eine Angebotsannahme startet die Buchungsprüfung. Erst der ausdrücklich gespeicherte Status `booking_confirmed` mit Buchungsreferenz bestätigt in dieser Demo die Buchung.
- Eingegangene Hotelangebote sind nicht automatisch kundensichtbar. Nur `customer_visible: true` zählt als sichtbar.
- Der Chat darf keine verbindliche Hotelantwortzeit versprechen. Ein vorhandener nächster Prüftermin ist ein interner Folgeschritt, keine Zusage des Hotels.
- Der Chat bestätigt keine Stornierung, wenn der Status das nicht ausdrücklich belegt.
- Aktuelle Vorgangsdaten werden bei der Anfrage neu gelesen. Sie landen nicht im allgemeinen RAG-Index.
- Benutzer dürfen nur die ihrer Firma zugeordneten und für sie freigegebenen Vorgänge sehen. Eine bekannte Anfrage-ID reicht nicht.
- Öffentliche Anleitungen benötigen keine Vorgangsdaten. Personenbezogene Statusfragen benötigen eine berechtigt abgefragte Datenquelle.

## Rollen

| Rolle | Aufgabe |
|---|---|
| Kunde | Eigene freigegebene Anfragen ansehen; Chat nutzen |
| Support | Informationen prüfen und bei Bedarf ein Ticket übernehmen |
| Artikelverantwortlicher | Inhalt prüfen, versionieren und freigeben |
| Backend | Identität/Zugriff prüfen; erlaubte Daten bereitstellen |
| Sprachmodell | Aus geprüften Quellen eine verständliche Antwort formulieren |

## Statusmodell

| Status | Bedeutung | Nächster sinnvoller Schritt |
|---|---|---|
| draft | Anfrage noch nicht abgesendet | Pflichtfelder prüfen und absenden |
| awaiting_responses | Hotels angefragt; Rückmeldungen können noch in Prüfung sein | Sichtbarkeit und nächsten Prüftermin prüfen |
| offers_available | Mindestens ein Angebot ist kundensichtbar | Angebotsübersicht öffnen |
| booking_pending | Angebot angenommen; Bestätigung steht aus | Buchungsprüfung verfolgen; nichts als bestätigt darstellen |
| booking_confirmed | Buchung bestätigt; Referenz vorhanden | Buchungsübersicht bzw. Bestätigung ansehen |
| cancelled | Vorgang als storniert gespeichert | Stornierungsnachweis im Vorgang prüfen |

Die Demo enthält vier Firmen, fünf Kundenprofile, ein Redaktionsprofil und acht erste Vorgänge. Es handelt sich um feste Ausgangsdaten, nicht um eine echte laufende Hotelanbindung. Das Redaktionsprofil „Robin · Wissenspflege“ verwaltet Artikel, hat aber keine freigegebenen Kundenvorgänge.
