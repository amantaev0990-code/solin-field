import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;

void main() {
  runApp(const SolinApp());
}

class SolinApp extends StatelessWidget {
  const SolinApp({super.key});

  @override
  Widget build(BuildContext context) {
    const seed = Color(0xFF32D267);
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'SOLI-N Field',
      theme: ThemeData(
        brightness: Brightness.dark,
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: seed,
          brightness: Brightness.dark,
          surface: const Color(0xFF082315),
        ),
        scaffoldBackgroundColor: const Color(0xFF04150B),
        cardColor: const Color(0xFF082315),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF06160D),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xFF2A6240)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xFF2A6240)),
          ),
        ),
      ),
      home: const SolinHomePage(),
    );
  }
}

class SolinRepository {
  static const _root = '../';

  Future<SolinData> load() async {
    final manifest = await _json('${_root}data-manifest.json') as Map<String, dynamic>;
    final meta = await _json('${_root}data-meta.json') as Map<String, dynamic>;
    final quarterFiles = (manifest['quarterChunks'] as List<dynamic>? ?? const [])
        .map((e) => e.toString())
        .toList();

    final quarters = <String, QuarterData>{};
    for (final file in quarterFiles) {
      final chunk = await _json('$_root$file') as Map<String, dynamic>;
      for (final entry in chunk.entries) {
        quarters[entry.key] = QuarterData.fromJson(entry.key, entry.value);
      }
    }

    final lookups = <String, Map<String, String>>{};
    final rawLookups = meta['fieldLookups'];
    if (rawLookups is Map<String, dynamic>) {
      for (final entry in rawLookups.entries) {
        final value = entry.value;
        if (value is Map<String, dynamic>) {
          lookups[entry.key] = value.map((k, v) => MapEntry(k, v?.toString() ?? ''));
        }
      }
    }

    final stats = meta['stats'] is Map<String, dynamic>
        ? Map<String, dynamic>.from(meta['stats'] as Map<String, dynamic>)
        : <String, dynamic>{};

    return SolinData(quarters: quarters, lookups: lookups, stats: stats);
  }

  Future<dynamic> _json(String path) async {
    final response = await http.get(Uri.parse(path), headers: const {'Cache-Control': 'no-cache'});
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('HTTP ${response.statusCode}: $path');
    }
    return jsonDecode(utf8.decode(response.bodyBytes));
  }
}

class SolinData {
  SolinData({
    required this.quarters,
    required this.lookups,
    required this.stats,
  });

  final Map<String, QuarterData> quarters;
  final Map<String, Map<String, String>> lookups;
  final Map<String, dynamic> stats;

  List<CompartmentData> get compartments =>
      quarters.values.expand((q) => q.compartments).toList();

  double get totalArea =>
      compartments.fold(0, (sum, item) => sum + item.area);

  String lookup(String key, dynamic value) {
    if (value == null || value.toString().isEmpty) return '—';
    const aliases = {
      'M3Pr': 'POR',
      'PORP': 'POR',
      'P15': 'POR',
      'PRP1': 'POR',
      'PRP2': 'POR',
      'PRP3': 'POR',
      'PLP1': 'POR',
      'PLP2': 'POR',
      'PLP3': 'POR',
    };
    final table = lookups[key] ?? lookups[aliases[key]];
    return table?[value.toString()] ?? value.toString();
  }
}

class QuarterData {
  QuarterData({
    required this.number,
    required this.compartments,
  });

  final String number;
  final List<CompartmentData> compartments;

  double get area => compartments.fold(0, (sum, item) => sum + item.area);

  factory QuarterData.fromJson(String number, dynamic value) {
    final map = value is Map<String, dynamic> ? value : <String, dynamic>{};
    final raw = map['compartments'] as List<dynamic>? ?? const [];
    return QuarterData(
      number: number,
      compartments: raw
          .whereType<Map<String, dynamic>>()
          .map(CompartmentData.fromJson)
          .toList(),
    );
  }
}

class CompartmentData {
  CompartmentData(this.raw);

  final Map<String, dynamic> raw;

  factory CompartmentData.fromJson(Map<String, dynamic> json) =>
      CompartmentData(Map<String, dynamic>.from(json));

  String get quarter => raw['KV']?.toString() ?? '—';
  String get number => raw['VD']?.toString() ?? '—';
  double get area => double.tryParse(raw['PLV']?.toString() ?? '') ?? 0;
}

class SolinHomePage extends StatefulWidget {
  const SolinHomePage({super.key});

  @override
  State<SolinHomePage> createState() => _SolinHomePageState();
}

class _SolinHomePageState extends State<SolinHomePage> {
  final repository = SolinRepository();
  late Future<SolinData> future;
  int tab = 1;
  String quarterSearch = '';
  String compartmentSearch = '';
  Position? position;
  String? gpsError;

  @override
  void initState() {
    super.initState();
    future = repository.load();
  }

  Future<void> locate() async {
    setState(() => gpsError = null);
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw Exception('Нет разрешения на геопозицию');
      }
      final p = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      if (!mounted) return;
      setState(() => position = p);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'GPS: ${p.latitude.toStringAsFixed(5)}, '
            '${p.longitude.toStringAsFixed(5)} · ±${p.accuracy.toStringAsFixed(0)} м',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => gpsError = e.toString());
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Не удалось получить GPS-точку')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<SolinData>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const _LoadingScreen();
        }
        if (snapshot.hasError || snapshot.data == null) {
          return _ErrorScreen(
            error: snapshot.error.toString(),
            onRetry: () => setState(() => future = repository.load()),
          );
        }
        return _MainShell(
          data: snapshot.data!,
          tab: tab,
          quarterSearch: quarterSearch,
          compartmentSearch: compartmentSearch,
          position: position,
          gpsError: gpsError,
          onTab: (value) => setState(() => tab = value),
          onQuarterSearch: (value) => setState(() => quarterSearch = value),
          onCompartmentSearch: (value) => setState(() => compartmentSearch = value),
          onLocate: locate,
        );
      },
    );
  }
}

class _LoadingScreen extends StatelessWidget {
  const _LoadingScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.park, size: 54, color: Color(0xFF40D86F)),
              SizedBox(height: 16),
              Text('SOLI-N Field', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
              SizedBox(height: 14),
              CircularProgressIndicator(),
              SizedBox(height: 10),
              Text('Загружаю данные SOLI-N…'),
            ],
          ),
        ),
      ),
    );
  }
}

class _ErrorScreen extends StatelessWidget {
  const _ErrorScreen({required this.error, required this.onRetry});

  final String error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, size: 52),
                const SizedBox(height: 16),
                const Text('Не удалось загрузить данные', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                Text(error, textAlign: TextAlign.center),
                const SizedBox(height: 18),
                FilledButton(onPressed: onRetry, child: const Text('Повторить')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MainShell extends StatelessWidget {
  const _MainShell({
    required this.data,
    required this.tab,
    required this.quarterSearch,
    required this.compartmentSearch,
    required this.position,
    required this.gpsError,
    required this.onTab,
    required this.onQuarterSearch,
    required this.onCompartmentSearch,
    required this.onLocate,
  });

  final SolinData data;
  final int tab;
  final String quarterSearch;
  final String compartmentSearch;
  final Position? position;
  final String? gpsError;
  final ValueChanged<int> onTab;
  final ValueChanged<String> onQuarterSearch;
  final ValueChanged<String> onCompartmentSearch;
  final VoidCallback onLocate;

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      _MapPage(position: position, gpsError: gpsError, onLocate: onLocate),
      _QuartersPage(data: data, search: quarterSearch, onSearch: onQuarterSearch),
      _CompartmentsPage(data: data, search: compartmentSearch, onSearch: onCompartmentSearch),
      _ReferencesPage(data: data),
      const _MorePage(),
    ];

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _TopBar(onLocate: onLocate),
            _ForestSummary(data: data),
            _SectionTabs(index: tab, onTap: onTab),
            Expanded(child: pages[tab]),
          ],
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.onLocate});

  final VoidCallback onLocate;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
      child: Row(
        children: [
          const Icon(Icons.park, size: 36, color: Color(0xFF40D86F)),
          const SizedBox(width: 10),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('SOLI-N Field', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
                Text('Таксация в поле', style: TextStyle(color: Color(0xFFA6C8B1))),
              ],
            ),
          ),
          OutlinedButton.icon(
            onPressed: onLocate,
            icon: const Icon(Icons.gps_fixed),
            label: const Text('GPS'),
          ),
        ],
      ),
    );
  }
}

class _ForestSummary extends StatelessWidget {
  const _ForestSummary({required this.data});

  final SolinData data;

  @override
  Widget build(BuildContext context) {
    final referenceCount = data.stats['referenceTables'] ?? 132;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Card(
        margin: const EdgeInsets.only(bottom: 10),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: const BorderSide(color: Color(0xFF1E5B38)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              const Row(
                children: [
                  Icon(Icons.park, color: Color(0xFF40D86F), size: 32),
                  SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Бугетсайское лесничество', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                        SizedBox(height: 3),
                        Text(
                          'Карабутакское государственное учреждение лесного хозяйства',
                          style: TextStyle(color: Color(0xFFA7B8AD), fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              GridView.count(
                crossAxisCount: 2,
                childAspectRatio: 2.35,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  _StatTile(icon: Icons.grid_view, value: data.quarters.length.toString(), label: 'Кварталов'),
                  _StatTile(icon: Icons.hexagon_outlined, value: data.compartments.length.toString(), label: 'Выделов'),
                  _StatTile(icon: Icons.landscape_outlined, value: data.totalArea.toStringAsFixed(1), label: 'Площадь, га'),
                  _StatTile(icon: Icons.menu_book_outlined, value: referenceCount.toString(), label: 'Справочников'),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.icon, required this.value, required this.label});

  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0C321E),
        border: Border.all(color: const Color(0xFF255D3A)),
        borderRadius: BorderRadius.circular(14),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      child: Row(
        children: [
          Icon(icon, color: const Color(0xFF72E790)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900)),
                Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFFC2D0C6))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTabs extends StatelessWidget {
  const _SectionTabs({required this.index, required this.onTap});

  final int index;
  final ValueChanged<int> onTap;

  static const items = [
    (Icons.map_outlined, 'Карта'),
    (Icons.grid_view, 'Кварталы'),
    (Icons.hexagon_outlined, 'Выделы'),
    (Icons.menu_book_outlined, 'Справочники'),
    (Icons.more_horiz, 'Ещё'),
  ];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 64,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: items.length,
        itemBuilder: (context, i) {
          final selected = i == index;
          return InkWell(
            onTap: () => onTap(i),
            child: Container(
              width: 92,
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    width: 3,
                    color: selected ? const Color(0xFF3EE47A) : Colors.transparent,
                  ),
                ),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(items[i].$1, color: selected ? Colors.white : const Color(0xFFA4B4AA)),
                  const SizedBox(height: 3),
                  Text(
                    items[i].$2,
                    style: TextStyle(
                      fontSize: 11,
                      color: selected ? Colors.white : const Color(0xFFA4B4AA),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _PageFrame extends StatelessWidget {
  const _PageFrame({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 110),
      child: child,
    );
  }
}

class _QuartersPage extends StatelessWidget {
  const _QuartersPage({required this.data, required this.search, required this.onSearch});

  final SolinData data;
  final String search;
  final ValueChanged<String> onSearch;

  @override
  Widget build(BuildContext context) {
    final quarters = data.quarters.values
        .where((q) => search.trim().isEmpty || q.number.contains(search.trim()))
        .toList()
      ..sort((a, b) => _numeric(a.number).compareTo(_numeric(b.number)));

    return _PageFrame(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Кварталы (${data.quarters.length})', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 10),
          TextField(
            onChanged: onSearch,
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Номер квартала…',
            ),
          ),
          const SizedBox(height: 6),
          ...quarters.map(
            (q) => _QuarterCard(
              quarter: q,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => QuarterPage(data: data, quarter: q)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuarterCard extends StatelessWidget {
  const _QuarterCard({required this.quarter, required this.onTap});

  final QuarterData quarter;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 5),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFF245A39)),
      ),
      child: ListTile(
        onTap: onTap,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        leading: Container(
          width: 54,
          height: 54,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0xFF0F3C25),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(quarter.number, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
        ),
        title: Text('Квартал ${quarter.number}', style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text('Выделов: ${quarter.compartments.length}\nПлощадь: ${quarter.area.toStringAsFixed(1)} га'),
        isThreeLine: true,
        trailing: const Icon(Icons.chevron_right),
      ),
    );
  }
}

class QuarterPage extends StatelessWidget {
  const QuarterPage({super.key, required this.data, required this.quarter});

  final SolinData data;
  final QuarterData quarter;

  @override
  Widget build(BuildContext context) {
    final items = [...quarter.compartments]
      ..sort((a, b) => _numeric(a.number).compareTo(_numeric(b.number)));
    return Scaffold(
      appBar: AppBar(title: Text('Квартал ${quarter.number}')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 40),
        children: [
          Text('${items.length} выделов · ${quarter.area.toStringAsFixed(1)} га', style: const TextStyle(color: Color(0xFFA7B8AD))),
          const SizedBox(height: 8),
          ...items.map((item) => _CompartmentCard(data: data, item: item)),
        ],
      ),
    );
  }
}

class _CompartmentsPage extends StatelessWidget {
  const _CompartmentsPage({required this.data, required this.search, required this.onSearch});

  final SolinData data;
  final String search;
  final ValueChanged<String> onSearch;

  @override
  Widget build(BuildContext context) {
    final q = search.trim().toLowerCase();
    final items = data.compartments.where((item) {
      if (q.isEmpty) return true;
      return item.quarter.toLowerCase().contains(q) || item.number.toLowerCase().contains(q);
    }).toList()
      ..sort((a, b) {
        final qa = _numeric(a.quarter).compareTo(_numeric(b.quarter));
        return qa != 0 ? qa : _numeric(a.number).compareTo(_numeric(b.number));
      });

    return _PageFrame(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Выделы (${data.compartments.length})', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 10),
          TextField(
            onChanged: onSearch,
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Квартал или номер выдела…',
            ),
          ),
          const SizedBox(height: 6),
          ...items.map((item) => _CompartmentCard(data: data, item: item)),
        ],
      ),
    );
  }
}

class _CompartmentCard extends StatelessWidget {
  const _CompartmentCard({required this.data, required this.item});

  final SolinData data;
  final CompartmentData item;

  @override
  Widget build(BuildContext context) {
    final category = data.lookup('KU', item.raw['KU']);
    final species = data.lookup('M3Pr', item.raw['M3Pr']);
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 5),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFF245A39)),
      ),
      child: ListTile(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => CompartmentPage(data: data, item: item)),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        leading: Container(
          width: 66,
          height: 54,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0xFF0F3C25),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text('${item.quarter}/${item.number}', style: const TextStyle(fontWeight: FontWeight.w900)),
        ),
        title: Text('Выдел ${item.number}', style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text(
          '${item.area.toStringAsFixed(1)} га · $category'
          '${species == '—' ? '' : '\nПорода: $species'}',
        ),
        isThreeLine: species != '—',
        trailing: const Icon(Icons.chevron_right),
      ),
    );
  }
}

class CompartmentPage extends StatelessWidget {
  const CompartmentPage({super.key, required this.data, required this.item});

  final SolinData data;
  final CompartmentData item;

  static const labels = {
    'PLV': 'Площадь, га',
    'KU': 'Категория угодий',
    'KGLF': 'Категория лесного фонда',
    'Fzona': 'Функциональная зона',
    'OZU': 'Особо защитный участок',
    'M3Pr': 'Преобладающая порода',
    'M3B': 'Класс бонитета',
    'M3TL': 'Тип леса',
    'M3TLU': 'Тип лесорастительных условий',
    'M3G': 'Группа возраста',
    'M3KP': 'Класс пожарной опасности',
    'M2PM1': 'Проектируемое мероприятие',
    'M2Pr': 'Интенсивность выборки, %',
    'PRkol': 'Количество подроста, тыс. шт./га',
    'PRH': 'Средняя высота подроста, м',
    'PRA': 'Возраст подроста',
  };

  @override
  Widget build(BuildContext context) {
    final groups = <String, List<String>>{
      'Основные сведения': ['PLV', 'KU', 'KGLF', 'Fzona', 'OZU'],
      'Лесорастительные условия': ['M3Pr', 'M3B', 'M3TL', 'M3TLU', 'M3G', 'M3KP'],
      'Проектируемые мероприятия': ['M2PM1', 'M2Pr'],
      'Подрост': ['PRkol', 'PRH', 'PRA'],
    };

    return Scaffold(
      appBar: AppBar(title: Text('Кв. ${item.quarter} · Выдел ${item.number}')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 40),
        children: [
          Text(
            '${item.area.toStringAsFixed(1)} га · ${data.lookup('KU', item.raw['KU'])}',
            style: const TextStyle(color: Color(0xFFA7B8AD)),
          ),
          const SizedBox(height: 12),
          for (final group in groups.entries)
            _FieldSection(
              title: group.key,
              children: [
                for (final key in group.value)
                  if (item.raw[key] != null && item.raw[key].toString().isNotEmpty)
                    _FieldTile(
                      label: labels[key] ?? key,
                      value: data.lookup(key, item.raw[key]),
                    ),
              ],
            ),
          if (item.raw['_children'] is Map<String, dynamic>)
            _ChildrenSection(data: data, childrenData: item.raw['_children'] as Map<String, dynamic>),
        ],
      ),
    );
  }
}

class _FieldSection extends StatelessWidget {
  const _FieldSection({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    if (children.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: Color(0xFF8CF2A5), fontWeight: FontWeight.w800)),
          const SizedBox(height: 7),
          ...children,
        ],
      ),
    );
  }
}

class _FieldTile extends StatelessWidget {
  const _FieldTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 7),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF071B10),
        border: Border.all(color: const Color(0xFF255B3A)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF9FB3A5))),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}

class _ChildrenSection extends StatelessWidget {
  const _ChildrenSection({required this.data, required this.childrenData});

  final SolinData data;
  final Map<String, dynamic> childrenData;

  static const names = {
    'Макет10': 'Древостой',
    'Макет11': 'Лесные культуры',
    'Макет12': 'Повреждения насаждений',
    'Макет13': 'Линейные объекты',
    'Макет14': 'Распределение территории',
    'Макет15': 'Выполненные мероприятия',
    'Макет17': 'Сенокосы и пастбища',
    'Макет19': 'Болота',
    'Макет20': 'Потери древесины',
    'Макет21': 'Ландшафтно-рекреационная оценка',
    'Макет23': 'Особенности выдела',
    'Макет25': 'Плантации',
    'Макет27': 'Прежняя категория угодий',
    'Макет28': 'Транспортная доступность',
  };

  @override
  Widget build(BuildContext context) {
    final widgets = <Widget>[];
    for (final entry in childrenData.entries) {
      final rows = entry.value is List<dynamic> ? entry.value as List<dynamic> : const [];
      if (rows.isEmpty) continue;
      widgets.add(
        ExpansionTile(
          tilePadding: EdgeInsets.zero,
          title: Text(names[entry.key] ?? entry.key, style: const TextStyle(fontWeight: FontWeight.w800)),
          children: [
            for (final row in rows.whereType<Map<String, dynamic>>())
              ...row.entries
                  .where((field) => !{'POS', 'LESN', 'KV', 'KGLF', 'VD'}.contains(field.key))
                  .where((field) => field.value != null && field.value.toString().isNotEmpty)
                  .map((field) => _FieldTile(
                        label: field.key,
                        value: data.lookup(field.key, field.value),
                      )),
          ],
        ),
      );
    }
    if (widgets.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Дополнительные макеты', style: TextStyle(color: Color(0xFF8CF2A5), fontWeight: FontWeight.w800)),
        ...widgets,
      ],
    );
  }
}

class _ReferencesPage extends StatelessWidget {
  const _ReferencesPage({required this.data});

  final SolinData data;

  static const refs = {
    'KU': 'Категории угодий',
    'POR': 'Древесные и кустарниковые породы',
    'IAR': 'Ярусы древостоя',
    'M3B': 'Классы бонитета',
    'TB': 'Типы болот',
  };

  @override
  Widget build(BuildContext context) {
    return _PageFrame(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Справочники SOLI-N', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 4),
          const Text('Понятные названия из Solim.mdb', style: TextStyle(color: Color(0xFFA7B8AD))),
          const SizedBox(height: 10),
          for (final ref in refs.entries)
            Card(
              margin: const EdgeInsets.symmetric(vertical: 5),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: const BorderSide(color: Color(0xFF245A39)),
              ),
              child: ExpansionTile(
                title: Text(ref.value, style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text('${data.lookups[ref.key]?.length ?? 0} значений'),
                children: [
                  for (final item in (data.lookups[ref.key] ?? const <String, String>{}).entries.take(250))
                    ListTile(
                      dense: true,
                      leading: Text(item.key, style: const TextStyle(color: Color(0xFF8EF0A4))),
                      title: Text(item.value),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _MapPage extends StatelessWidget {
  const _MapPage({required this.position, required this.gpsError, required this.onLocate});

  final Position? position;
  final String? gpsError;
  final VoidCallback onLocate;

  @override
  Widget build(BuildContext context) {
    return _PageFrame(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Карта', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 4),
          const Text('Flutter-слой карты переносится отдельно от основного интерфейса.', style: TextStyle(color: Color(0xFFA7B8AD))),
          const SizedBox(height: 12),
          Container(
            height: 260,
            width: double.infinity,
            decoration: BoxDecoration(
              color: const Color(0xFF0B2B19),
              border: Border.all(color: const Color(0xFF245A39)),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.map_outlined, size: 54, color: Color(0xFF72E790)),
                SizedBox(height: 10),
                Text('CMF2 / офлайн-карта', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                SizedBox(height: 4),
                Text('Будет подключена следующим этапом'),
              ],
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: onLocate,
            icon: const Icon(Icons.gps_fixed),
            label: const Text('Определить моё положение'),
          ),
          if (position != null) ...[
            const SizedBox(height: 10),
            _FieldTile(label: 'Широта', value: position!.latitude.toStringAsFixed(6)),
            _FieldTile(label: 'Долгота', value: position!.longitude.toStringAsFixed(6)),
            _FieldTile(label: 'Точность', value: '±${position!.accuracy.toStringAsFixed(0)} м'),
          ],
          if (gpsError != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(gpsError!, style: const TextStyle(color: Colors.redAccent)),
            ),
        ],
      ),
    );
  }
}

class _MorePage extends StatelessWidget {
  const _MorePage();

  @override
  Widget build(BuildContext context) {
    return _PageFrame(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Ещё', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          const _InfoCard(
            icon: Icons.cloud_off_outlined,
            title: 'Офлайн-режим',
            text: 'Архитектура Flutter подготовлена для локального хранения. Полную локальную базу подключим после переноса карты.',
          ),
          const _InfoCard(
            icon: Icons.import_export,
            title: 'Импорт / экспорт SOLI-N',
            text: 'Форматы Transfer и CMF2 будут перенесены из текущей веб-версии отдельными модулями.',
          ),
          const _InfoCard(
            icon: Icons.phone_iphone,
            title: 'Одна кодовая база',
            text: 'Этот же проект будет собираться как Flutter Web, Android APK и iOS-приложение.',
          ),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.icon, required this.title, required this.text});

  final IconData icon;
  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFF245A39)),
      ),
      child: ListTile(
        leading: Icon(icon, color: const Color(0xFF72E790)),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text(text),
      ),
    );
  }
}

int _numeric(String value) => int.tryParse(value) ?? 999999;
