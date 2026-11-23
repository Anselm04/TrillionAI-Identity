/// UI-only operation guard. A response from a previous login cannot
/// modify the current account view; server authorization is independent.
class AccountOperationGeneration {
  int _generation = 0;
  bool _running = false;

  int? begin() {
    if (_running) return null;
    _running = true;
    return ++_generation;
  }

  bool isCurrent(int ticket) => _running && ticket > 0 && ticket == _generation;

  bool finish(int ticket) {
    if (!isCurrent(ticket)) return false;
    _running = false;
    return true;
  }

  void invalidate() {
    _generation++;
    _running = false;
  }
}
