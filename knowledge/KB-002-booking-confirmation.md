# Ist ein Angebot schon eine bestätigte Buchung?

Artikel KB-002 · Version 1.0 · Freigegebener Demoartikel. Metadaten: data/articles.json.

## Problem und Gültigkeit
Der Kunde verwechselt eine Angebotsübersicht oder die Angebotsannahme mit der endgültigen Bestätigung. Dieser Artikel beschreibt ausschließlich RaumPilots fiktiven Ablauf.

## Allgemeine Regel
Eine Anfrage oder ein sichtbares Angebot ist keine bestätigte Buchung. Eine Annahme startet die Buchungsprüfung. Nur booking_confirmed mit vorhandener booking_reference darf als bestätigt bezeichnet werden.

## Fundstellen
Anfragen → Vorgang → Buchungsübersicht: status, booking_reference und updated_at. Diese Oberfläche wird im nächsten Entwicklungsschritt implementiert.

## Bearbeitung
Allgemeine Erklärung: keine Kundendaten benötigt. Konkreter Statusfall: zuerst Sitzung und Zugriff prüfen, dann aktuelle Daten abrufen. booking_pending: Annahme in Prüfung, noch keine Bestätigung. booking_confirmed mit Referenz: bestätigt. Status bestätigt ohne Referenz: widersprüchlicher Datensatz, nicht raten und übergeben.

## Antworten
Noch offen: „Das Angebot liegt vor; aktuell gibt es keine bestätigte Buchung.“
In Prüfung: „Die Buchungsprüfung läuft. Eine endgültige Bestätigung liegt im Vorgang noch nicht vor.“
Bestätigt: „Deine Buchung ist im Vorgang bestätigt. Die Referenz lautet [geprüfte Referenz].“

Keine Aussage, dass eine Bestätigungs-E-Mail angekommen sei: Versand und Empfang sind in der Demo nicht belegt.
