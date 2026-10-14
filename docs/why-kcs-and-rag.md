# Warum KCS und RAG zusammenpassen

**KCS pflegt das Wissen. RAG stellt der Antwortgenerierung passende Ausschnitte dieses Wissens bereit.** Sie lösen unterschiedliche Teile desselben Supportproblems.

## KCS: Wissen entsteht im Support

Im Knowledge-Centered Service werden vorhandene Lösungen gesucht und wiederverwendet. Beim Bearbeiten einer Anfrage werden fehlende Informationen ergänzt, vorhandene Inhalte verbessert oder ein neuer Artikel angelegt. Artikel beschreiben Problem, Kontext und Lösung; Metadaten machen Zustand und Entwicklung nachvollziehbar.

Unsere Demo ist KCS-orientiert. Eine Sammlung guter Artikel allein beweist noch keine vollständige KCS-Einführung in einem Unternehmen. Dazu gehören auch tatsächliche Nutzung, Verantwortlichkeiten und die laufende Verbesserung im Arbeitsprozess.

## RAG: Das richtige Wissen bei der konkreten Frage

Retrieval-Augmented Generation sucht passende Artikelabschnitte und gibt sie dem Modell zusammen mit der Frage. Das Modell erhält dadurch fachlichen Kontext und kann Quellen nennen. Häufig wechselnde Produktregeln müssen dafür nicht jedes Mal in ein Modell neu trainiert werden.

Der Index ist eine abgeleitete Suchstruktur, nicht die verbindliche Originalquelle. Artikel und Metadaten bleiben zentral versioniert; Änderungen müssen anschließend im Index ankommen.

## Wie beides im Beispiel zusammenarbeitet

1. Lena fragt nach dem Status von RFP-1042.
2. Die Suche findet den freigegebenen Artikel KB-001.
3. Der Zugriff wurde bereits vor der Wissenssuche geprüft. Das Backend liest den aktuellen erlaubten Vorgang separat.
4. Das Modell erhält den gefundenen freigegebenen Artikel und die erlaubten Daten. Die kurzen Demoartikel werden vollständig übergeben, damit Bedingungen und Ausnahmen zusammenbleiben.
5. Die Antwort verweist auf den Artikel und unterscheidet eingegangene von sichtbaren Angeboten.
6. Falls eine Ausnahme fehlt, entsteht ein Verbesserungsvorschlag zur Prüfung.

Wenn derselbe Artikel mehrfach genutzt wird, können die Wiederverwendung und die dabei entdeckten Lücken protokolliert werden. Dadurch liefert der Chat Hinweise für die Wissenspflege; geprüfte Verbesserungen helfen wiederum bei künftigen Antworten.

## Projektspezifische Qualitätsregeln

- Nur für diese Zielgruppe freigegebene aktuelle Fassungen in den kundenbezogenen Index aufnehmen.
- Entwürfe und archivierte Artikel für Kundenantworten ausschließen; interne Arbeitsprozesse können andere Sichtbarkeiten haben.
- Kunden-, Firmen- und Berechtigungsdaten nicht als allgemeines Produktwissen behandeln.
- Quellen und Versionen nachweisen; eine passende klingende Antwort reicht nicht.
- Bei fehlenden Quellen oder nicht erreichbaren Vorgangsdaten begrenzen, nachfragen oder übergeben.
- Artikelentwürfe nicht automatisch als verbindliches Wissen veröffentlichen.

Diese Freigabepolitik ist eine Entscheidung für unsere Demo, keine Behauptung, KCS schreibe überall denselben Freigabeprozess vor.

## Grenzen

KCS verbessert die Wissenspflege. RAG verbessert den Zugriff auf dieses Wissen. Keines garantiert fehlerfreie Antworten: Suchtreffer können unvollständig sein, das Modell kann Inhalte falsch verknüpfen und Quellen können veralten. Deshalb testen wir Suche, Datenzugriff, Fakten und Übergaben getrennt.

## Primärquellen

- [Consortium for Service Innovation: KCS v6 Practices Guide](https://library.serviceinnovation.org/KCS/KCS_v6/KCS_v6_Practices_Guide)
- [Microsoft: Retrieval augmented generation and indexes](https://learn.microsoft.com/en-us/azure/foundry/concepts/retrieval-augmented-generation)

Die Projektartikel und Produktregeln sind eigene fiktive Beispiele; sie sind keine übernommenen Unternehmensunterlagen.
