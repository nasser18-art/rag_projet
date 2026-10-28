"""Chatbot en ligne de commande conservé pour les utilisateurs existants."""

from rag.engine import RagConfigurationError, RagProviderError, get_engine


def main() -> None:
    print("📥 Chargement de la base de connaissances...")
    question = input("\n💬 Posez votre question : ").strip()
    if not question:
        print("❌ Veuillez saisir une question.")
        return
    try:
        answer, sources = get_engine().answer(question)
    except RagConfigurationError as exc:
        print(f"❌ Configuration incomplète : {exc}")
        return
    except RagProviderError:
        print("❌ Le service de génération est temporairement indisponible.")
        return

    print("\n" + "=" * 60)
    print("📝 RÉPONSE DE L'ASSISTANT :")
    print("=" * 60)
    print(answer)
    print("\n" + "-" * 60)
    print("📚 SOURCES UTILISÉES :")
    for source in sources:
        print(f"  - {source.document} (Catégorie : {source.category})")
    print("=" * 60)


if __name__ == "__main__":
    main()
