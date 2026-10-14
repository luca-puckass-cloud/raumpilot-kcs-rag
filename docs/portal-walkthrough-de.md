# Kundenportal und Wissenspflege ausprobieren

## Start

Im Projektordner `npm start` ausführen und http://127.0.0.1:4175 öffnen. Der Server ist ausschließlich an die lokale Loopback-Adresse gebunden. Neue Anfrageentwürfe und Tickets sind temporär. Artikelentwürfe, Versionen, Wissenslücken und Feedback bleiben im ignorierten lokalen Ordner `runtime/` erhalten.

## Was du ausprobieren kannst

1. **Anfragen:** Filter verwenden, nach Titel/Ort/ID suchen und eine Anfrage öffnen. Lena sieht RFP-1042, RFP-1043 und RFP-1044.
2. **Vorgangsdetails:** Hotelkontakte, eingegangene Rückmeldungen und kundensichtbare Angebote unterscheiden.
3. **Chat:** „Wie ist der aktuelle Status?“ fragen. Bei RFP-1042 muss die Antwort zwei Rückmeldungen, aber null sichtbare Angebote erklären.
4. **Quellen:** KB-001 in der Antwort anklicken. Artikel, Version, Freigabe und Bearbeitungsweg werden angezeigt.
5. **Buchung:** Bei RFP-1044 fragen, ob bereits gebucht ist. Der gespeicherte Status ist booking_pending, nicht bestätigt.
6. **Berechtigung:** Als Lena nach RFP-2042 fragen. Der Chat gibt keine Vorgangsdetails heraus. Auch ein userId-Wert im Chat-Request überschreibt die serverseitige Sitzung nicht.
7. **Profilwechsel:** Unter „Demoprofil & Modell“ Mia wählen. Nun ist RFP-2042 für dieses Profil sichtbar. Dieser offene Wechsel ist nur eine Testfunktion, keine echte Unternehmensanmeldung.
8. **Neue Anfrage:** Einen Entwurf mit Titel, Ort, gültigem zukünftigem Datum und Teilnehmerzahl speichern. Es wird kein Hotel kontaktiert.
9. **Support:** Ein Ticket anlegen. Es erscheint im aktuellen lokalen Profil, ohne Versand an ein Unternehmen.

## Was „Demoantwort“ bedeutet

Die Standardantwort stammt aus überprüfbaren Produktregeln, nicht aus einem vorgetäuschten Sprachmodell. Die Wissenssuche verwendet lokal berechnete Embeddings, sofern der Index aktuell ist. Die Antwortformulierung bleibt im Demo-Modus regelbasiert. Unter „Nachweise ansehen“ steht, ob die Suche semantisch oder als Stichwort-Fallback erfolgte. Aktuelle Vorgangsdaten werden separat und berechtigt abgefragt.

## Ollama-Modus

Unter den Demo-Einstellungen „Lokales Ollama-Modell“ und ein installiertes lokales Chatmodell auswählen. Auf diesem Rechner wurde qwen3.8:27b geprüft. Der Backend-Standard bleibt qwen3:8b, wenn keine andere Auswahl übergeben wird. Die Modellliste kommt aus Ollama; nicht installierte oder Cloud-Modelle können nicht aufgerufen werden. Das Embedding-Modell qwen3-embedding:0.6b ist ein separates, kleineres Suchmodell.

Der Server schickt nur die Frage, freigegebenes Wissen und berechtigte Demodaten an die lokale Ollama-API. Die Anbindung verlangt JSON mit Antwort und erlaubten Quellen-IDs. JSON-Format und Quellenanzeige garantieren keine fachlich korrekten Inhalte.

Bei fehlendem Modell oder Fehler erscheint eine ausdrücklich markierte regelbasierte Ersatzantwort. Cloud-Modellnamen werden abgewiesen. Der Connector lädt selbst kein Modell herunter.

## Den KCS Kreislauf vorführen

1. Als Lena eine noch unbeantwortete Frage stellen, etwa zur Rechnungsaufteilung bei einer frischen Demo. Der Chat erfindet keine Regel und erfasst eine Wissenslücke.
2. Unter „Demoprofil & Modell“ **Robin · Wissenspflege** wählen. „Wissenspflege“ öffnen.
3. Bei der Wissenslücke „Artikelentwurf“ anklicken. Problem, Gültigkeitsbereich, konkreten Bearbeitungsweg und Ausnahmen ausfüllen. Eine kurze Suchbeschreibung ergänzt Begriffe aus Kundensicht.
4. Entwurf speichern. Die Kunden-Wissensbasis und der Index enthalten diesen Artikel noch nicht.
5. „Zur Prüfung“ wählen, Inhalt kontrollieren und mit einer konkreten fachlichen Prüfnotiz freigeben. Die Wissenslücke wird als bearbeitet markiert und der Index aktualisiert.
6. Als Lena dieselbe Frage im Ollama-Modus stellen. Die Antwort soll die neue Anleitung verwenden und ihre Version nennen.
7. „Ja“ oder „Es fehlt etwas“ als Feedback wählen. Quellenabrufe und Rückmeldungen erscheinen in der Wissenspflege; negatives Feedback eröffnet eine Wissenslücke.
8. „Neue Fassung“ erstellt einen Entwurf, während die alte freigegebene Fassung verfügbar bleibt. Erst nach Freigabe wird sie ersetzt. Archivierte Artikel bleiben in der Historie, nicht in der Kundensuche.

Die Rechnungsregel ist ausdrücklich erfunden für RaumPilot, keine Regel eines realen Unternehmens. Auf Lucas lokalem Rechner wurde der Musterartikel KB-004 bereits durch diesen Ablauf freigegeben. Für eine erneute Vorführung eine andere Wissenslücke verwenden; vorhandene Arbeit nicht löschen.

## Technische Grenzen

- Lokales Entwicklungsprojekt, kein produktionsfertiger Dienst.
- Fiktive Daten, keine echten Hotels, Zahlungen oder personenbezogenen Kundenvorgänge.
- Sitzung und Zugriffsfilter vorhanden; Demo-Profilwechsel ersetzt keine echte Authentifizierung.
- Keine dauerhafte Datenbank für neue Entwürfe/Tickets.
- Semantische Suche auf einem kleinen Entwicklungsset kalibriert; noch keine breite unabhängige Qualitätsmessung der Modellantworten.
- Freigabe verlangt eine menschliche Prüfung, erzwingt aber keine zweite Person.
- Keine echte Unternehmensanmeldung, Backups, Betriebsüberwachung, vollständige Datenschutzfilterung oder allgemeine prompt-injection-sichere Architektur.
- Fragen werden einzeln mit dem ausgewählten Vorgang verarbeitet; Modell-Konversationsspeicher folgt später.

## Durchgeführte Prüfung

21 automatisierte Tests prüfen Datenkonsistenz, Profilzugriff, gefälschte Benutzerangaben, Quellenfilter, unbekannte Fragen, Modell-Rückfälle, Entwürfe, Tickets, fremde Origins, Freigaben, persistente Wissenspflege, konkurrierende Änderungen und veraltete Suchindizes. Ein Integrationstest mit einer kontrollierten Modellantwort prüft erlaubte Daten und lokale Modellauswahl.

Browserprüfung: Anfrage, Quellen, Profilwechsel, Anfrageentwurf, Ticket und Ablehnung einer fremden Anfrage. Zusätzlich wurde eine Wissenslücke in einen Artikelentwurf überführt, seine Nicht-Sichtbarkeit vor Freigabe geprüft und nach Freigabe eine echte lokale Modellantwort mit KB-004 als Quelle erzeugt. Die schmale Ansicht hat eine kompakte Tabelle und einen separat geöffneten Supportchat. Modellfälle stehen in model-check.md. Es wurden keine Cloud-Ressourcen angelegt.
