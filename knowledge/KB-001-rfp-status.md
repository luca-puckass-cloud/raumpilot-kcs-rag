# Wie ist der Status meiner Anfrage und wann kommen Hotelangebote?

Artikel KB-001 · Version 1.0 · Freigegebener Demoartikel. Formale Metadaten: data/articles.json.

## Problem aus Kundensicht
„Ich habe eine Anfrage verschickt, aber sehe noch keine Hotelangebote. Ist meine Anfrage angekommen und muss ich etwas tun?“

## Gültigkeitsbereich
RaumPilot, Anfrageübersicht und Hotelangebotsstatus. Keine Aussagen über echte Hotels oder Bestellungen.

## Voraussetzungen und Fundstellen
Bei einer konkreten Anfrage-ID muss das Backend zuerst eine gültige Sitzung und die Zugriffsberechtigung für genau diesen Vorgang prüfen. Erst danach Vorgangsdaten lesen.

Geplante Fundstelle im Produkt: Anfragen → ausgewählter Vorgang → Status / Hotelrückmeldungen / Angebotsübersicht. Technische Datenfelder: status, hotels_contacted, responses_received, offers[].customer_visible, next_review_at, updated_at.

## Bearbeitungsweg
1. Bei personenbezogenem Statusfall Sitzung und Zugriff prüfen. Eine Anfrage-ID ist kein Berechtigungsnachweis.
2. Aktuelle erlaubte Vorgangsdaten über das Backend abrufen; bei Fehler keine alten Daten als aktuell darstellen.
3. draft: Anfrage noch nicht abgesendet; Pflichtfelder und Versand prüfen.
4. awaiting_responses und null Rückmeldungen: Hotels angefragt, Rückmeldungen stehen aus.
5. Rückmeldungen vorhanden, aber keine kundensichtbaren Angebote: Rückmeldungen sind vorhanden und noch in Prüfung.
6. Kundensichtbare Angebote vorhanden: Auf die Angebotsübersicht verweisen.
7. Konkrete Buchungsfragen nach KB-002 bearbeiten.

## Antwortbaustein
„Deine Anfrage wurde an [Anzahl] Hotels übermittelt. [Anzahl] Rückmeldungen liegen vor. Die Angebote sind [geprüfte Sichtbarkeit]. [Geprüfter nächster Schritt].“

Nur Angaben aus dem berechtigten Abruf einsetzen. Fehlende Werte nicht schätzen. Ein interner Prüftermin ist kein zugesagter Angebotsliefertermin.

## Ausnahmen und Übergabe
Keine Berechtigung: keine Vorgangsdaten herausgeben. Datenquelle nicht erreichbar: Einschränkung erklären und Übergabe anbieten. Widersprüchliche Zähler/Status: keine definitive Antwort, technischen Support einschalten. Kein Hoteltermin gespeichert: keinen versprechen.

## Qualitätsprüfung
RFP-1042: fünf Hotels, zwei Rückmeldungen, null sichtbare Angebote. Erwartung: noch keine Angebote zur Ansicht, nicht „keine Hotelantwort“. Fremde ID: keine Daten. Sichtbares Angebot: keine automatische Buchungsbestätigung.
