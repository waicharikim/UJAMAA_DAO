// src/data/counties.ts

const counties = [
  {
    name: 'Mombasa',
    code: '1',
    constituencies: [
    { name: 'Changamwe', wards: ['Port Reitz', 'Kipevu', 'Airport', 'Changamwe', 'Chaani'] },
    { name: 'Jomvu', wards: ['Jomvu Kuu', 'Miritini', 'Mikindani'] },
    { name: 'Kisauni', wards: ['Mjambere', 'Junda', 'Bamburi', 'Mwakirunge', 'Mtopanga', 'Magogoni', 'Shanzu'] },
    { name: 'Nyali', wards: ['Frere Town', 'Ziwa La Ng\'ombe', 'Mkomani', 'Kongowea', 'Kadzandani'] },
    { name: 'Likoni', wards: ['Mtongwe', 'Shika Adabu', 'Bofu', 'Likoni', 'Timbwani'] },
    { name: 'Mvita', wards: ['Mji Wa Kale/Makadara', 'Tudor', 'Tononoka', 'Shimanzi/Ganjoni', 'Majengo'] }
  ]
  },

  {
    name: 'Kwale',
    code: '2',
    constituencies: [
    { name: 'Msambweni', wards: ['Gombatobongwe', 'Ukunda', 'Kinondo', 'Ramisi'] },
    { name: 'Lungalunga', wards: ['Pongwekikoneni', 'Dzombo', 'Mwereni', 'Vanga'] },
    { name: 'Matuga', wards: ['Tsimba Golini', 'Waa', 'Tiwi', 'Kubo South', 'Mkongani'] },
    { name: 'Kinango', wards: ['Nadavaya', 'Puma', 'Kinango', 'Mackinnon-Road', 'Chengoni/Samburu', 'Mwavumbo', 'Kasemeni'] }
  ]
  },

  { 
    name: 'Kilifi',
    code: '3',
    constituencies: [
    { name: 'Kilifi North', wards: ['Tezo', 'Sokoni', 'Kibarani', 'Dabaso', 'Matsangoni', 'Watamu', 'Mnarani'] },
    { name: 'Kilifi South', wards: ['Junju', 'Mwarakaya', 'Shimo La Tewa', 'Chasimba', 'Mtepeni'] },
    { name: 'Kaloleni', wards: ['Mariakani', 'Kayafungo', 'Kaloleni', 'Mwanamwinga'] },
    { name: 'Rabai', wards: ['Mwawesa', 'Ruruma', 'Kambe/Ribe', 'Rabai/Kisurutini'] },
    { name: 'Ganze', wards: ['Ganze', 'Bamba', 'Jaribuni', 'Sokoke'] },
    { name: 'Malindi', wards: ['Jilore', 'Kakuyuni', 'Ganda', 'Malindi Town', 'Shella'] },
    { name: 'Magarini', wards: ['Marafa', 'Magarini', 'Gongoni', 'Adu', 'Garashi', 'Sabaki'] }
  ]
  },

  { 
    name: 'Tana River',
    code: '4',
    constituencies: [
    { name: 'Garsen', wards: ['Kipini East', 'Garsen South', 'Kipini West', 'Garsen Central', 'Garsen West', 'Garsen North'] },
    { name: 'Galole', wards: ['Kinakomba', 'Mikinduni', 'Chewani', 'Wayu'] },
    { name: 'Bura', wards: ['Chewele', 'Bura', 'Bangale', 'Sala', 'Madogo'] }
  ]
  },

  {
    name: 'Lamu',
    code: '5',
    constituencies: [
    { name: 'Lamu East', wards: ['Faza', 'Kiunga', 'Basuba'] },
    { name: 'Lamu West', wards: ['Shella', 'Mkomani', 'Hindi', 'Mkunumbi', 'Hongwe', 'Witu', 'Bahari'] }
  ]
  },

  {
    name: 'Taita Taveta',
    code: '6',
    constituencies: [
    { name: 'Taveta', wards: ['Chala', 'Mahoo', 'Bomeni', 'Mboghoni', 'Mata'] },
    { name: 'Wundanyi', wards: ['Wundanyi/Mbale', 'Werugha', 'Wumingu/Kishushe', 'Mwanda/Mgange'] },
    { name: 'Mwatate', wards: ['Rong\'e', 'Mwatate', 'Bura', 'Chawia', 'Wusi/Kishamba'] },
    { name: 'Voi', wards: ['Mbololo', 'Sagalla', 'Kaloleni', 'Marungu', 'Kasigau', 'Ngolia'] }
  ]
  },

  {
    name: 'Garissa',
    code: '7',
    constituencies: [
    { name: 'Garissa Township', wards: ['Waberi', 'Galbet', 'Township', 'Iftin'] },
    { name: 'Balambala', wards: ['Balambala', 'Danyere', 'Jara Jara', 'Saka', 'Sankuri'] },
    { name: 'Lagdera', wards: ['Modogashe', 'Benane', 'Goreale', 'Maalimin', 'Sabena', 'Baraki'] },
    { name: 'Dadaab', wards: ['Dertu', 'Dadaab', 'Labasigale', 'Damajale', 'Liboi', 'Abakaile'] },
    { name: 'Fafi', wards: ['Bura', 'Dekaharia', 'Jarajila', 'Fafi', 'Nanighi'] },
    { name: 'Ijara', wards: ['Hulugho', 'Sangailu', 'Ijara', 'Masalani'] },
  ]
  },

  {
    name: 'Wajir',
    code: '8',
    constituencies: [
    { name: 'Wajir North', wards: ['Gurar', 'Bute', 'Korondile', 'Malkagufu', 'Batalu', 'Danaba', 'Godoma'] },
    { name: 'Wajir East', wards: ['Wagberi', 'Township', 'Barwago', 'Khorof/Harar'] },
    { name: 'Tarbaj', wards: ['Elben', 'Sarman', 'Tarbaj', 'Wargadud'] },
    { name: 'Wajir West', wards: ['Arbajahan', 'Hadado/Athibohol', 'Ademasajide', 'Wagalla/Ganyure'] },
    { name: 'Eldas', wards: ['Eldas', 'Della', 'Lakoley South/Basir', 'Elnur/Tula Tula'] },
    { name: 'Wajir South', wards: ['Benane', 'Burder', 'Dadaja Bulla', 'Habasswein', 'Lagboghol South', 'Ibrahim Ure', 'Diif'] },
  ]
  },

  {
    name: 'Mandera',
    code: '9',
    constituencies: [
    { name: 'Mandera West', wards: ['Takaba South', 'Takaba', 'Lag Sure', 'Dandu', 'Gither'] },
    { name: 'Banissa', wards: ['Banissa', 'Derkhale', 'Guba', 'Malkamari', 'Kiliwehiri'] },
    { name: 'Mandera North', wards: ['Ashabito', 'Guticha', 'Morothile', 'Rhamu', 'Rhamu-Dimtu'] },
    { name: 'Mandera South', wards: ['Wargudud', 'Kutulo', 'Elwak South', 'Elwak North', 'Shimbir Fatuma'] },
    { name: 'Mandera East', wards: ['Arabia', 'Bulla Mpya', 'Khalalio', 'Neboi', 'Township'] },
    { name: 'Lafey', wards: ['Libehia', 'Fino', 'Lafey', 'Warankara', 'Alungo Gof'] },
  ]
  },

  {
    name: 'Marsabit',
    code: '10',
    constituencies: [
    { name: 'Moyale', wards: ['Butiye', 'Sololo', 'Heilu-Manyatta', 'Golbo', 'Moyale Township', 'Uran', 'Obbu'] },
    { name: 'North Horr', wards: ['Illeret', 'North Horr', 'Dukana', 'Maikona', 'Turbi'] },
    { name: 'Saku', wards: ['Sagante/Jaldesa', 'Karare', 'Marsabit Central'] },
    { name: 'Laisamis', wards: ['Loiyangalani', 'Kargi/South Horr', 'Korr/Ngurunit', 'Log Logo', 'Laisamis'] },
  ]
  },

  {
    name: 'Isiolo',
    code: '11',
    constituencies: [
    { name: 'Isiolo North', wards: ['Wabera', 'Bulla Pesa', 'Chari', 'Cherab', 'Ngare Mara', 'Burat', 'Oldonyiro'] },
    { name: 'Isiolo South', wards: ['Garbatulla', 'Kinna', 'Sericho'] },
  ]
  },

  {
    name: 'Meru',
    code: '12',
    constituencies: [
    { name: 'Igembe South', wards: ['Maua', 'Kiegoi/Antubochiu', 'Athiru Gaiti', 'Akachiu', 'Kanuni'] },
    { name: 'Igembe Central', wards: ['Akirang\'ondu', 'Athiru Ruujine', 'Igembe East', 'Njia', 'Kangeta'] },
    { name: 'Igembe North', wards: ['Antuambui', 'Ntunene', 'Antubetwe Kiongo', 'Naathu', 'Amwathi'] },
    { name: 'Tigania West', wards: ['Athwana', 'Akithii', 'Kianjai', 'Nkomo', 'Mbeu'] },
    { name: 'Tigania East', wards: ['Thangatha', 'Mikinduri', 'Kiguchwa', 'Muthara', 'Karama'] },
    { name: 'North Imenti', wards: ['Municipality', 'Ntima East', 'Ntima West', 'Nyaki West', 'Nyaki East'] },
    { name: 'Buuri', wards: ['Timau', 'Kisima', 'Kiirua/Naari', 'Ruiri/Rwarera', 'Kibirichia'] },
    { name: 'Central Imenti', wards: ['Mwanganthia', 'Abothuguchi Central', 'Abothuguchi West', 'Kiagu'] },
    { name: 'South Imenti', wards: ['Mitunguu', 'Igoji East', 'Igoji West', 'Abogeta East', 'Abogeta West', 'Nkuene'] },
  ]
  },

  {
    name: 'Tharaka-Nithi',
    code: '13',
    constituencies: [
    { name: 'Maara', wards: ['Mitheru', 'Muthambi', 'Mwimbi', 'Ganga', 'Chogoria'] },
    { name: 'Chuka/Igambang\'om', wards: ['Mariani', 'Karingani', 'Magumoni', 'Mugwe', 'Igambang\'ombe'] },
    { name: 'Tharaka', wards: ['Gatunga', 'Mukothima', 'Nkondi', 'Chiakariga', 'Marimanti'] },
  ]
  },

  {
    name: 'Embu',
    code: '14',
    constituencies: [
      { name: 'Manyatta', wards: ['Ruguru/Ngandori', 'Kithimu', 'Nginda', 'Mbeti North', 'Kirimari', 'Gaturi South'] },
      { name: 'Runyenjes', wards: ['Gaturi North', 'Kagaari South', 'Central  Ward', 'Kagaari North', 'Kyeni North', 'Kyeni South'] },
      { name: 'Mbeere South', wards: ['Mwea', 'Makima', 'Mbeti South', 'Mavuria', 'Kiambere'] },
      { name: 'Mbeere North', wards: ['Nthawa', 'Muminji', 'Evurore'] },
    ]
  },

  {
    name: 'Kitui',
    code: '15',
    constituencies: [
      { name: 'Mwingi North', wards: ['Ngomeni', 'Kyuso', 'Mumoni', 'Tseikuru', 'Tharaka'] },
      { name: 'Mwingi West', wards: ['Kyome/Thaana', 'Nguutani', 'Migwani', 'Kiomo/Kyethani'] },
      { name: 'Mwingi Central', wards: ['Central', 'Kivou', 'Nguni', 'Nuu', 'Mui', 'Waita'] },
      { name: 'Kitui West', wards: ['Mutonguni', 'Kauwi', 'Matinyani', 'Kwa Mutonga/Kithumula'] },
      { name: 'Kitui Rural', wards: ['Kisasi', 'Mbitini', 'Kwavonza/Yatta', 'Kanyangi'] },
      { name: 'Kitui Central', wards: ['Miambani', 'Township', 'Kyangwithya West', 'Mulango', 'Kyangwithya East'] },
      { name: 'Kitui East', wards: ['Zombe/Mwitika', 'Chuluni', 'Nzambani', 'Voo/Kyamatu', 'Endau/Malalani', 'Mutito/Kaliku'] },
      { name: 'Kitui South', wards: ['Ikanga/Kyatune', 'Mutomo', 'Mutha', 'Ikutha', 'Kanziko', 'Athi'] },
    ]
  },

  {
    name: 'Machakos',
    code: '16',
    constituencies: [
      { name: 'Masinga', wards: ['Kivaa', 'Masinga Central', 'Ekalakala', 'Muthesya', 'Ndithini'] },
      { name: 'Yatta', wards: ['Ndalani', 'Matuu', 'Kithimani', 'Ikombe', 'Katangi'] },
      { name: 'Kangundo', wards: ['Kangundo North', 'Kangundo Central', 'Kangundo East', 'Kangundo West'] },
      { name: 'Matungulu', wards: ['Tala', 'Matungulu North', 'Matungulu East', 'Matungulu West', 'Kyeleni'] },
      { name: 'Kathiani', wards: ['Mitaboni', 'Kathiani Central', 'Upper Kaewa/Iveti', 'Lower Kaewa/Kaani'] },
      { name: 'Mavoko', wards: ['Athi River', 'Kinanie', 'Muthwani', 'Syokimau/Mulolongo'] },
      { name: 'Machakos Town', wards: ['Kalama', 'Mua', 'Mutituni', 'Machakos Central', 'Mumbuni North', 'Muvuti/Kiima-Kimwe', 'Kola'] },
      { name: 'Mwala', wards: ['Mbiuni', 'Makutano/ Mwala', 'Masii', 'Muthetheni', 'Wamunyu', 'Kibauni'] },
    ]
  },

  {
    name: 'Makueni',
    code: '17',
    constituencies: [
      { name: 'Mbooni', wards: ['Tulimani', 'Mbooni', 'Kithungo/Kitundu', 'Kisau/Kiteta', 'Waia/Kako', 'Kalawa'] },
      { name: 'Kilome', wards: ['Kasikeu', 'Mukaa', 'Kiima Kiu/Kalanzoni'] },
      { name: 'Kaiti', wards: ['Ukia', 'Kee', 'Kilungu', 'Ilima'] },
      { name: 'Makueni', wards: ['Wote', 'Muvau/Kikuumini', 'Mavindini', 'Kitise/Kithuki', 'Kathonzweni', 'Nzaui/Kilili/Kalamba', 'Mbitini'] },
      { name: 'Kibwezi West', wards: ['Makindu', 'Nguumo', 'Kikumbulyu North', 'Kikumbulyu South', 'Nguu/Masumba', 'Emali/Mulala'] },
      { name: 'Kibwezi East', wards: ['Masongaleni', 'Mtito Andei', 'Thange', 'Ivingoni/Nzambani'] },
    ]
  },

  {
    name: 'Nyandarua',
    code: '18',
    constituencies: [
      { name: 'Kinangop', wards: ['Engineer', 'Gathara', 'North Kinangop', 'Murungaru', 'Njabini\Kiburu', 'Nyakio', 'Githabai', 'Magumu'] },
      { name: 'Kipipiri', wards: ['Wanjohi', 'Kipipiri', 'Geta', 'Githioro'] },
      { name: 'Ol Kalou', wards: ['Karau', 'Kanjuiri Ridge', 'Mirangine', 'Kaimbaga', 'Rurii'] },
      { name: 'Ol Jorok', wards: ['Gathanji', 'Gatimu', 'Weru', 'Charagita'] },
      { name: 'Ndaragwa', wards: ['Leshau Pondo', 'Kiriita', 'Central', 'Shamata'] },
    ]
  },

  {
    name: 'Nyeri',
    code: '19',
    constituencies: [
      { name: 'Tetu', wards: ['Dedan Kimanthi', 'Wamagana', 'Aguthi/Gaaki'] },
      { name: 'Kieni', wards: ['Mweiga', 'Naromoru Kiamathaga', 'Mwiyogo/Endarasha', 'Mugunda', 'Gatarakwa', 'Thegu River', 'Kabaru', 'Gakawa'] },
      { name: 'Mathira', wards: ['Ruguru', 'Magutu', 'Iriaini', 'Konyu', 'Kirimukuyu', 'Karatina Town'] },
      { name: 'Othaya', wards: ['Mahiga', 'Iria-Ini', 'Chinga', 'Karima'] },
      { name: 'Mukurweini', wards: ['Gikondi', 'Rugi', 'Mukurwe-Ini West', 'Mukurwe-Ini Central'] },
      { name: 'Nyeri Town', wards: ['Kiganjo/Mathari', 'Rware', 'Gatitu/Muruguru', 'Ruring\'u', 'Kamakwa/Mukaro'] },
    ]
  },

  {
    name: 'Kirinyaga',
    code: '20',
    constituencies: [
      { name: 'Mwea', wards: ['Mutithi', 'Kangai', 'Thiba', 'Wamumu', 'Nyangati', 'Murinduko', 'Gathigiriri', 'Tebere'] },
      { name: 'Gichugu', wards: ['Kabare', 'Baragwi', 'Njukiini', 'Ngariama', 'Karumandi'] },
      { name: 'Ndia', wards: ['Mukure', 'Kiine', 'Kariti'] },
      { name: 'Kirinyaga Central', wards: ['Mutira', 'Kanyeki-Ini', 'Kerugoya', 'Inoi'] },
    ]
  },

  {
    name: 'Murang\'a',
    code: '21',
    constituencies: [
      { name: 'Kangema', wards: ['Kanyenyaini', 'Muguru', 'Rwathia'] },
      { name: 'Mathioya', wards: ['Gitugi', 'Kiru', 'Kamacharia'] },
      { name: 'Kiharu', wards: ['Wangu', 'Mugoiri', 'Mbiri', 'Township', 'Murarandia', 'Gaturi'] },
      { name: 'Kigumo', wards: ['Kahumbu', 'Muthithi', 'Kigumo', 'Kangari', 'Kinyona'] },
      { name: 'Maragwa', wards: ['Kimorori/Wempa', 'Makuyu', 'Kambiti', 'Kamahuha', 'Ichagaki', 'Nginda'] },
      { name: 'Kandara', wards: ['Ng\'araria', 'Muruka', 'Kagundu-Ini', 'Gaichanjiru', 'Ithiru', 'Ruchu'] },
      { name: 'Gatanga', wards: ['Ithanga', 'Kakuzi/Mitubiri', 'Mugumo-Ini', 'Kihumbu-Ini', 'Gatanga', 'Kariara'] },
    ]
  },

  {
    name: 'Kiambu',
    code: '22',
    constituencies: [
      { name: 'Gatundu South', wards: ['Kiamwangi', 'Kiganjo', 'Ndarugu', 'Ngenda'] },
      { name: 'Gatundu North', wards: ['Gituamba', 'Githobokoni', 'Chania', 'Mang\'u'] },
      { name: 'Juja', wards: ['Murera', 'Theta', 'Juja', 'Witeithie', 'Kalimoni'] },
      { name: 'Thika Town', wards: ['Township', 'Kamenu', 'Hospital', 'Gatuanyaga', 'Ngoliba'] },
      { name: 'Ruiru', wards: ['Gitothua', 'Biashara', 'Gatongora', 'Kahawa Sukari', 'Kahawa Wendani', 'Kiuu', 'Mwiki', 'Mwihoko'] },
      { name: 'Githunguri', wards: ['Githunguri', 'Githiga', 'Ikinu', 'Ngewa', 'Komothai'] },
      { name: 'Kiambu', wards: ['Ting\'ang\'a', 'Ndumberi', 'Riabai', 'Township'] },
      { name: 'Kiambaa', wards: ['Cianda', 'Karuri', 'Ndenderu', 'Muchatha', 'Kihara'] },
      { name: 'Kabete', wards: ['Gitaru', 'Muguga', 'Nyadhuna', 'Kabete', 'Uthiru'] },
      { name: 'Kikuyu', wards: ['Karai', 'Nachu', 'Sigona', 'Kikuyu', 'Kinoo'] },
      { name: 'Limuru', wards: ['Bibirioni', 'Limuru Central', 'Ndeiya', 'Limuru East', 'Ngecha Tigoni'] },
      { name: 'Lari', wards: ['Kinale', 'Kijabe', 'Nyanduma', 'Kamburu', 'Lari/Kirenga'] },
    ]
  },

  {
    name: 'Turkana',
    code: '23',
    constituencies: [
      { name: 'Turkana North', wards: ['Kaeris', 'Lake Zone', 'Lapur', 'Kaaleng/Kaikor', 'Kibish', 'Nakalale'] },
      { name: 'Turkana West', wards: ['Kakuma', 'Lopur', 'Letea', 'Songot', 'Kalobeyei', 'Lokichoggio', 'Nanaam'] },
      { name: 'Turkana Central', wards: ['Kerio Delta', 'Kang\'atotha', 'Kalokol', 'Lodwar Township', 'Kanamkemer'] },
      { name: 'Loima', wards: ['Kotaruk/Lobei', 'Turkwel', 'Loima', 'Lokiriama/Lorengippi'] },
      { name: 'Turkana South', wards: ['Kaputir', 'Katilu', 'Lobokat', 'Kalapata', 'Lokichar'] },
      { name: 'Turkana East', wards: ['Kapedo/Napeitom', 'Katilia', 'Lokori/Kochodin'] },
    ]
  },

  {
    name: 'West Pokot',
    code: '24',
    constituencies: [
      { name: 'Kapenguria', wards: ['Riwo', 'Kapenguria', 'Mnagei', 'Siyoi', 'Endugh', 'Sook'] },
      { name: 'Sigor', wards: ['Sekerr', 'Masool', 'Lomut', 'Weiwei'] },
      { name: 'Kacheliba', wards: ['Suam', 'Kodich', 'Kapckok', 'Kasei', 'Kiwawa', 'Alale'] },
      { name: 'Pokot South', wards: ['Chepareria', 'Batei', 'Lelan', 'Tapach'] },
    ]
  },

  {
    name: 'Samburu',
    code: '25',
    constituencies: [
      { name: 'Samburu West', wards: ['Lodokejek', 'Suguta Marmar', 'Maralal', 'Loosuk', 'Poro'] },
      { name: 'Samburu North', wards: ['El-Barta', 'Nachola', 'Ndoto', 'Nyiro', 'Angata Nanyokie', 'Baawa'] },
      { name: 'Samburu East', wards: ['Waso', 'Wamba West', 'Wamba East', 'Wamba North'] },
    ]
  },

  {
    name: 'Trans Nzoia',
    code: '26',
    constituencies: [
      { name: 'Kwanza', wards: ['Kapomboi', 'Kwanza', 'Keiyo', 'Bidii'] },
      { name: 'Endebess', wards: ['Chepchoina', 'Endebess', 'Matumbei'] },
      { name: 'Saboti', wards: ['Kinyoro', 'Matisi', 'Tuwani', 'Saboti', 'Machewa'] },
      { name: 'Kiminini', wards: ['Kiminini', 'Waitaluk', 'Sirende', 'Hospital', 'Sikhendu', 'Nabiswa'] },
      { name: 'Cherangany', wards: ['Sinyerere', 'Makutano', 'Kaplamai', 'Motosiet', 'Cherangany/Suwerwa', 'Chepsiro/Kiptoror', 'Sitatunga'] },
    ]
  },

  {
    name: 'Uasin Gishu',
    code: '27',
    constituencies: [
      { name: 'Soy', wards: ['Moi\'s Bridge', 'Kapkures', 'Ziwa', 'Segero/Barsombe', 'Kipsomba', 'Soy', 'Kuinet/Kapsuswa'] },
      { name: 'Turbo', wards: ['Ngenyilel', 'Tapsagoi', 'Kamagut', 'Kiplombe', 'Kapsaos', 'Huruma'] },
      { name: 'Moiben', wards: ['Tembelio', 'Sergoit', 'Karuna/Meibeki', 'Moiben', 'Kimumu'] },
      { name: 'Ainabkoi', wards: ['Kapsoya', 'Kaptagat', 'Ainabkoi/Olare'] },
      { name: 'Kapseret', wards: ['Simat/Kapseret', 'Kipkenyo', 'Ngeria', 'Megun', 'Langas'] },
      { name: 'Kesses', wards: ['Racecourse', 'Cheptiret/Kipchamo', 'Tulwet/Chuiyat', 'Tarakwa'] },
    ]
  },

  {
    name: 'Elgeyo/Marakwet',
    code: '28',
    constituencies: [
      { name: 'Marakwet East', wards: ['Kapyego', 'Sambirir', 'Endo', 'Embobut / Embulot'] },
      { name: 'Marakwet West', wards: ['Lelan', 'Sengwer', 'Cherang\'any/Chebororwa', 'Moiben/Kuserwo', 'Kapsowar', 'Arror'] },
      { name: 'Keiyo North', wards: ['Emsoo', 'Kamariny', 'Kapchemutwa', 'Tambach'] },
      { name: 'Keiyo South', wards: ['Kaptarakwa', 'Chepkorio', 'Soy North', 'Soy South', 'Kabiemit', 'Metkei'] },
    ]
  },

  {
    name: 'Nandi',
    code: '29',
    constituencies: [
      { name: 'Tinderet', wards: ['Songhor/Soba', 'Tindiret', 'Chemelil/Chemase', 'Kapsimotwo'] },
      { name: 'Aldai', wards: ['Kabwareng', 'Terik', 'Kemeloi-Maraba', 'Kobujoi', 'Kaptumo-Kaboi', 'Koyo-Ndurio'] },
      { name: 'Nandi Hills', wards: ['Nandi Hills', 'Chepkunyuk', 'Ol\'lessos', 'Kapchorua'] },
      { name: 'Chesumei', wards: ['Chemundu/Kapng\'etuny', 'Kosirai', 'Lelmokwo/Ngechek', 'Kaptel/Kamoiywo', 'Kiptuya'] },
      { name: 'Emgwen', wards: ['Chepkumia', 'Kapkangani', 'Kapsabet', 'Kilibwoni'] },
      { name: 'Mosop', wards: ['Chepterwai', 'Kipkaren', 'Kurgung/Surungai', 'Kabiyet', 'Ndalat', 'Kabisaga', 'Sangalo/Kebulonik'] },
    ]
  },

  {
    name: 'Baringo',
    code: '30',
    constituencies: [
      { name: 'Tiaty', wards: ['Tirioko', 'Kolowa', 'Ribkwo', 'Silale', 'Loiyamorock', 'Tangulbei/Korossi', 'Churo/Amaya'] },
      { name: 'Baringo Central', wards: ['Kabarnet', 'Sacho', 'Tenges', 'Ewalel Chapchap', 'Kapropita'] },
      { name: 'Baringo South', wards: ['Marigat', 'Ilchamus', 'Mochongoi', 'Mukutani'] },
      { name: 'Mogotio', wards: ['Mogotio', 'Emining', 'Kisanana'] },
      { name: 'Eldama Ravine', wards: ['Lembus', 'Lembus Kwen', 'Ravine', 'Mumberes/Maji Mazuri', 'Lembus/Perkerra', 'Koibatek'] },
      { name: 'Baringo North', wards: ['Barwessa', 'Kabartonjo', 'Saimo/Soi', 'Bartabwa', 'Saimo/Kipsaraman'] },
    ]
  },

  {
    name: 'Laikipia',
    code: '31',
    constituencies: [
      { name: 'Laikipia West', wards: ['Olmoran', 'Rumuruti Township', 'Kinamba', 'Marmanet', 'Igwamiti', 'Salama'] },
      { name: 'Laikipia East', wards: ['Ngobit', 'Tigithi', 'Thingithu', 'Nanyuki', 'Umande'] },
      { name: 'Laikipia North', wards: ['Sosian', 'Segera', 'Mukogondo West', 'Mukogondo East'] },
    ]
  },

  {
    name: 'Nakuru',
    code: '32',
    constituencies: [
      { name: 'Molo', wards: ['Mariashoni', 'Elburgon', 'Turi', 'Molo'] },
      { name: 'Njoro', wards: ['Maunarok', 'Mauche', 'Kihingo', 'Nessuit', 'Lare', 'Njoro'] },
      { name: 'Naivasha', wards: ['Biashara', 'Hells Gate', 'Lakeview', 'Maai-Mahiu', 'Maiella', 'Olkaria', 'Naivasha East', 'Viwandani'] },
      { name: 'Gilgil', wards: ['Gilgil', 'Elementaita', 'Mbaruk/Eburu', 'Malewa West', 'Murindati'] },
      { name: 'Kuresoi South', wards: ['Amalo', 'Keringet', 'Kiptagich', 'Tinet'] },
      { name: 'Kuresoi North', wards: ['Kiptororo', 'Nyota', 'Sirikwa', 'Kamara'] },
      { name: 'Subukia', wards: ['Subukia', 'Waseges', 'Kabazi'] },
      { name: 'Rongai', wards: ['Menengai West', 'Soin', 'Visoi', 'Mosop', 'Solai'] },
      { name: 'Bahati', wards: ['Dundori', 'Kabatini', 'Kiamaina', 'Lanet/Umoja', 'Bahati'] },
      { name: 'Nakuru Town West', wards: ['Barut', 'London', 'Kaptembwo', 'Kapkures', 'Rhoda', 'Shaabab'] },
      { name: 'Nakuru Town East', wards: ['Biashara', 'Kivumbini', 'Flamingo', 'Menengai', 'Nakuru East'] },
    ]
  },

  {
    name: 'Narok',
    code: '33',
    constituencies: [
      { name: 'Kilgoris', wards: ['Kilgoris Central', 'Keyian', 'Angata Barikoi', 'Shankoe', 'Kimintet', 'Lolgorian'] },
      { name: 'Emurua Dikirr', wards: ['Ilkerin', 'Ololmasani', 'Mogondo', 'Kapsasian'] },
      { name: 'Narok North', wards: ['Olpusimoru', 'Olokurto', 'Narok Town', 'Nkareta', 'Olorropil', 'Melili'] },
      { name: 'Narok East', wards: ['Mosiro', 'Ildamat', 'Keekonyokie', 'Suswa'] },
      { name: 'Narok South', wards: ['Majimoto/Naroosura', 'Ololulung\'a', 'Melelo', 'Loita', 'Sogoo', 'Sagamian'] },
      { name: 'Narok West', wards: ['Ilmotiok', 'Mara', 'Siana', 'Naikarra'] },
    ]
  },

  {
    name: 'Kajiado',
    code: '34',
    constituencies: [
      { name: 'Kajiado North', wards: ['Olkeri', 'Ongata Rongai', 'Nkaimurunya', 'Oloolua', 'Ngong'] },
      { name: 'Kajiado Central', wards: ['Purko', 'Ildamat', 'Dalalekutuk', 'Matapato North', 'Matapato South'] },
      { name: 'Kajiado East', wards: ['Kaputiei North', 'Kitengela', 'Oloosirkon/Sholinke', 'Kenyawa-Poka', 'Imaroro'] },
      { name: 'Kajiado West', wards: ['Keekonyokie', 'Iloodokilani', 'Magadi', 'Ewuaso Oonkidong\'i', 'Mosiro'] },
      { name: 'Kajiado South', wards: ['Entonet/Lenkisim', 'Mbirikani/Eselenkei', 'Kuku', 'Rombo', 'Kimana'] },
    ]
  },

  {
    name: 'Kericho',
    code: '35',
    constituencies: [
      { name: 'Kipkelion East', wards: ['Londiani', 'Kedowa/Kimugul', 'Chepseon', 'Tendeno/Sorget'] },
      { name: 'Kipkelion West', wards: ['Kunyak', 'Kamasian', 'Kipkelion', 'Chilchila'] },
      { name: 'Ainamoi', wards: ['Kapsoit', 'Ainamoi', 'Kapkugerwet', 'Kipchebor', 'Kipchimchim', 'Kapsaos'] },
      { name: 'Bureti', wards: ['Kisiara', 'Tebesonik', 'Cheboin', 'Chemosot', 'Litein', 'Cheplanget', 'Kapkatet'] },
      { name: 'Belgut', wards: ['Waldai', 'Kabianga', 'Cheptororiet/Seretut', 'Chaik', 'Kapsuser'] },
      { name: 'Sigowet/Soin', wards: ['Sigowet', 'Kaplelartet', 'Soliat', 'Soin'] },
    ]
  },

  {
    name: 'Bomet',
    code: '36',
    constituencies: [
      { name: 'Sotik', wards: ['Ndanai/Abosi', 'Chemagel', 'Kipsonoi', 'Kapletundo', 'Rongena/Manaret'] },
      { name: 'Chepalungu', wards: ['Kong\'asis', 'Nyangores', 'Sigor', 'Chebunyo', 'Siongiroi'] },
      { name: 'Bomet East', wards: ['Merigi', 'Kembu', 'Longisa', 'Kipreres', 'Chemaner'] },
      { name: 'Bomet Central', wards: ['Silibwet Township', 'Ndaraweta', 'Singorwet', 'Chesoen', 'Mutarakwa'] },
      { name: 'Konoin', wards: ['Chepchabas', 'Kimulot', 'Mogogosiek', 'Boito', 'Embomos'] },
    ]
  },

  {
    name: 'Kakamega',
    code: '37',
    constituencies: [
      { name: 'Lugari', wards: ['Mautuma', 'Lugari', 'Lumakanda', 'Chekalini', 'Chevaywa', 'Lwandeti'] },
      { name: 'Likuyani', wards: ['Likuyani', 'Sango', 'Kongoni', 'Nzoia', 'Sinoko'] },
      { name: 'Malava', wards: ['West Kabras', 'Chemuche', 'East Kabras', 'Butali/Chegulo', 'Manda-Shivanga', 'Shirugu-Mugai', 'South Kabras'] },
      { name: 'Lurambi', wards: ['Butsotso East', 'Butsotso South', 'Butsotso Central', 'Sheywe', 'Mahiakalo', 'Shirere'] },
      { name: 'Navakholo', wards: ['Ingostse-Mathia', 'Shinoyi-Shikomari-', 'Bunyala West', 'Bunyala East', 'Bunyala Central'] },
      { name: 'Mumias West', wards: ['Mumias Central', 'Mumias North', 'Etenje', 'Musanda'] },
      { name: 'Mumias East', wards: ['Lubinu/Lusheya', 'Isongo/Makunga/Malaha', 'East Wanga'] },
      { name: 'Matungu', wards: ['Koyonzo', 'Kholera', 'Khalaba', 'Mayoni', 'Namamali'] },
      { name: 'Butere', wards: ['Marama West', 'Marama Central', 'Marenyo - Shianda', 'Marama North', 'Marama South'] },
      { name: 'Khwisero', wards: ['Kisa North', 'Kisa East', 'Kisa West', 'Kisa Central'] },
      { name: 'Shinyalu', wards: ['Isukha North', 'Murhanda', 'Isukha Central', 'Isukha South', 'Isukha East', 'Isukha West'] },
      { name: 'Ikolomani', wards: ['Idakho South', 'Idakho East', 'Idakho North', 'Idakho Central'] },
    ]
  },

  {
    name: 'Vihiga',
    code: '38',
    constituencies: [
      { name: 'Vihiga', wards: ['Lugaga-Wamuluma', 'South Maragoli', 'Central Maragoli', 'Mungoma'] },
      { name: 'Sabatia', wards: ['Lyaduywa/Izava', 'West Sabatia', 'Chavakali', 'North Maragoli', 'Wodanga', 'Busali'] },
      { name: 'Hamisi', wards: ['Shiru', 'Muhudu', 'Shamakhokho', 'Gisambai', 'Banja', 'Tambua', 'Jepkoyai'] },
      { name: 'Luanda', wards: ['Luanda Township', 'Wemilabi', 'Mwibona', 'Luanda South', 'Emabungo'] },
      { name: 'Emuhaya', wards: ['North East Bunyore', 'Central Bunyore', 'West Bunyore'] },
    ]
  },

  {
    name: 'Bungoma',
    code: '39',
    constituencies: [
      { name: 'Mt.Elgon', wards: ['Cheptais', 'Chesikaki', 'Chepyuk', 'Kapkateny', 'Kaptama', 'Elgon'] },
      { name: 'Sirisia', wards: ['Namwela', 'Malakisi/South Kulisiru', 'Lwandanyi'] },
      { name: 'Kabuchai', wards: ['Kabuchai/Chwele', 'West Nalondo', 'Bwake/Luuya', 'Mukuyuni'] },
      { name: 'Bumula', wards: ['South Bukusu', 'Bumula', 'Khasoko', 'Kabula', 'Kimaeti', 'West Bukusu', 'Siboti'] },
      { name: 'Kanduyi', wards: ['Bukembe West', 'Bukembe East', 'Township', 'Khalaba', 'Musikoma', 'East Sang\'alo', 'Marakaru/Tuuti', 'Sang\'alo West'] },
      { name: 'Webuye East', wards: ['Mihuu', 'Ndivisi', 'Maraka'] },
      { name: 'Webuye West', wards: ['Misikhu', 'Sitikho', 'Matulo', 'Bokoli'] },
      { name: 'Kimilili', wards: ['Kimilili', 'Kibingei', 'Maeni', 'Kamukuywa'] },
      { name: 'Tongaren', wards: ['Mbakalo', 'Naitiri/Kabuyefwe', 'Milima', 'Ndalu/ Tabani', 'Tongaren', 'Soysambu/ Mitua'] },
    ]
  },

  {
    name: 'Busia',
    code: '40',
    constituencies: [
      { name: 'Teso North', wards: ['Malaba Central', 'Malaba North', 'Ang\'urai South', 'Ang\'urai North', 'Ang\'urai East', 'Malaba South'] },
      { name: 'Teso South', wards: ['Ang\'orom', 'Chakol South', 'Chakol North', 'Amukura West', 'Amukura East', 'Amukura Central'] },
      { name: 'Nambale', wards: ['Nambale Township', 'Bukhayo North/Waltsi', 'Bukhayo East', 'Bukhayo Central'] },
      { name: 'Matayos', wards: ['Bukhayo West', 'Mayenje', 'Matayos South', 'Busibwabo', 'Burumba'] },
      { name: 'Butula', wards: ['Marachi West', 'Kingandole', 'Marachi Central', 'Marachi East', 'Marachi North', 'Elugulu'] },
      { name: 'Funyula', wards: ['Namboboto Nambuku', 'Nangina', 'Ageng\'a Nanguba', 'Bwiri'] },
      { name: 'Budalangi', wards: ['Bunyala Central', 'Bunyala North', 'Bunyala West', 'Bunyala South'] },
    ]
  },

  {
    name: 'Siaya',
    code: '41',
    constituencies: [
      { name: 'Ugenya', wards: ['West Ugenya', 'Ukwala', 'North Ugenya', 'East Ugenya'] },
      { name: 'Ugunja', wards: ['Sidindi', 'Sigomere', 'Ugunja'] },
      { name: 'Alego Usonga', wards: ['Usonga', 'West Alego', 'Central Alego', 'Siaya Township', 'North Alego', 'South East Alego'] },
      { name: 'Gem', wards: ['North Gem', 'West Gem', 'Central Gem', 'Yala Township', 'East Gem', 'South Gem'] },
      { name: 'Bondo', wards: ['West Yimbo', 'Central Sakwa', 'South Sakwa', 'Yimbo East', 'West Sakwa', 'North Sakwa'] },
      { name: 'Rarieda', wards: ['East Asembo', 'West Asembo', 'North Uyoma', 'South Uyoma', 'West Uyoma'] },
    ]
  },

  {
    name: 'Kisumu',
    code: '42',
    constituencies: [
      { name: 'Kisumu East', wards: ['Kajulu', 'Kolwa East', 'Manyatta B', 'Nyalenda A', 'Kolwa Central'] },
      { name: 'Kisumu West', wards: ['South West Kisumu', 'Central Kisumu', 'Kisumu North', 'West Kisumu', 'North West Kisumu'] },
      { name: 'Kisumu Central', wards: ['Railways', 'Migosi', 'Shaurimoyo Kaloleni', 'Market Milimani', 'Kondele', 'Nyalenda B'] },
      { name: 'Seme', wards: ['West Seme', 'Central Seme', 'East Seme', 'North Seme'] },
      { name: 'Nyando', wards: ['East Kano/Wawidhi', 'Awasi/Onjiko', 'Ahero', 'Kabonyo/Kanyagwal', 'Kobura'] },
      { name: 'Muhoroni', wards: ['Miwani', 'Ombeyi', 'Masogo/Nyang\'oma', 'Chemelil', 'Muhoroni/Koru'] },
      { name: 'Nyakach', wards: ['South West Nyakach', 'North Nyakach', 'Central Nyakach', 'West Nyakach', 'South East Nyakach'] },
    ]
  },

  {
    name: 'Homa Bay',
    code: '43',
    constituencies: [
      { name: 'Kasipul', wards: ['West Kasipul', 'South Kasipul', 'Central Kasipul', 'East Kamagak', 'West Kamagak'] },
      { name: 'Kabondo Kasipul', wards: ['Kabondo East', 'Kabondo West', 'Kokwanyo/Kakelo', 'Kojwach'] },
      { name: 'Karachuonyo', wards: ['West Karachuonyo', 'North Karachuonyo', 'Central', 'Kanyaluo', 'Kibiri', 'Wangchieng', 'Kendu Bay Town'] },
      { name: 'Rangwe', wards: ['West Gem', 'East Gem', 'Kagan', 'Kochia'] },
      { name: 'Homa Bay Town', wards: ['Homa Bay Central', 'Homa Bay Arujo', 'Homa Bay West', 'Homa Bay East'] },
      { name: 'Ndhiwa', wards: ['Kwabwai', 'Kanyadoto', 'Kanyikela', 'North Kabuoch', 'Kabuoch South/Pala', 'Kanyamwa Kologi', 'Kanyamwa Kosewe'] },
      { name: 'Mbita', wards: ['Mfangano Island', 'Rusinga Island', 'Kasgunga', 'Gembe', 'Lambwe'] },
      { name: 'Suba', wards: ['Gwassi South', 'Gwassi North', 'Kaksingri West', 'Ruma Kaksingri East'] },
    ]
  },

  {
    name: 'Migori',
    code: '44',
    constituencies: [
      { name: 'Rongo', wards: ['North Kamagambo', 'Central Kamagambo', 'East Kamagambo', 'South Kamagambo'] },
      { name: 'Awendo', wards: ['North Sakwa', 'South Sakwa', 'West Sakwa', 'Central Sakwa'] },
      { name: 'Suna East', wards: ['God Jope', 'Suna Central', 'Kakrao', 'Kwa'] },
      { name: 'Suna West', wards: ['Wiga', 'Wasweta Ii', 'Ragana-Oruba', 'Wasimbete'] },
      { name: 'Uriri', wards: ['West Kanyamkago', 'North Kanyamkago', 'Central Kanyamkago', 'South Kanyamkago', 'East Kanyamkago'] },
      { name: 'Nyatike', wards: ['Kachien\'g', 'Kanyasa', 'North Kadem', 'Macalder/Kanyarwanda', 'Kaler', 'Got Kachola', 'Muhuru'] },
      { name: 'Kuria West', wards: ['Bukira East', 'Bukira Centrl/Ikerege', 'Isibania', 'Makerero', 'Masaba', 'Tagare', 'Nyamosense/Komosoko'] },
      { name: 'Kuria East', wards: ['Gokeharaka/Getambwega', 'Ntimaru West', 'Ntimaru East', 'Nyabasi East', 'Nyabasi West'] },
    ]
  },

  {
    name: 'Kisii',
    code: '45',
    constituencies: [
      { name: 'Bonchari', wards: ['Bomariba', 'Bogiakumu', 'Bomorenda', 'Riana'] },
      { name: 'South Mugirango', wards: ['Tabaka', 'Boikang\'a', 'Bogetenga', 'Borabu / Chitago', 'Moticho', 'Getenga'] },
      { name: 'Bomachoge Borabu', wards: ['Bombaba Borabu', 'Boochi Borabu', 'Bokimonge', 'Magenche'] },
      { name: 'Bobasi', wards: ['Masige West', 'Masige East', 'Bobasi Central', 'Nyacheki', 'Bobasi Bogetaorio', 'Bobasi Chache', 'Sameta/Mokwerero', 'Bobasi Boitangare'] },
      { name: 'Bomachoge Chache', wards: ['Majoge', 'Boochi/Tendere', 'Bosoti/Sengera'] },
      { name: 'Nyaribari Masaba', wards: ['Ichuni', 'Nyamasibi', 'Masimba', 'Gesusu', 'Kiamokama'] },
      { name: 'Nyaribari Chache', wards: ['Bobaracho', 'Kisii Central', 'Keumbu', 'Kiogoro', 'Birongo', 'Ibeno'] },
      { name: 'Kitutu Chache North', wards: ['Monyerero', 'Sensi', 'Marani', 'Kegogi'] },
      { name: 'Kitutu Chache South', wards: ['Bogusero', 'Bogeka', 'Nyakoe', 'Kitutu   Central', 'Nyatieko'] },
    ]
  },

  {
    name: 'Nyamira',
    code: '46',
    constituencies: [
      { name: 'Kitutu Masaba', wards: ['Rigoma', 'Gachuba', 'Kemera', 'Magombo', 'Manga', 'Gesima'] },
      { name: 'West Mugirango', wards: ['Nyamaiya', 'Bogichora', 'Bosamaro', 'Bonyamatuta', 'Township'] },
      { name: 'North Mugirango', wards: ['Itibo', 'Bomwagamo', 'Bokeira', 'Magwagwa', 'Ekerenyo'] },
      { name: 'Borabu', wards: ['Mekenene', 'Kiabonyoru', 'Nyansiongo', 'Esise'] },
    ]
  },

  {
    name: 'Nairobi',
    code: '47',
    constituencies: [
      { name: 'Westlands', wards: ['Kitisuru', 'Parklands/Highridge', 'Karura', 'Kangemi', 'Mountain View'] },
      { name: 'Dagoretti North', wards: ['Kilimani', 'Kawangware', 'Gatina', 'Kileleshwa', 'Kabiro'] },
      { name: 'Dagoretti South', wards: ['Mutuini', 'Ngando', 'Riruta', 'Uthiru/Ruthimitu', 'Waithaka'] },
      { name: 'Langata', wards: ['Karen', 'Nairobi West', 'Mugumo-Ini', 'South-C', 'Nyayo Highrise'] },
      { name: 'Kibra', wards: ['Laini Saba', 'Lindi', 'Makina', 'Woodley/Kenyatta Golf', 'Sarangombe'] },
      { name: 'Roysambu', wards: ['Githurai', 'Kahawa West', 'Zimmerman', 'Roysambu', 'Kahawa'] },
      { name: 'Kasarani', wards: ['Claycity', 'Mwiki', 'Kasarani', 'Njiru', 'Ruai'] },
      { name: 'Ruaraka', wards: ['Baba Dogo', 'Utalii', 'Mathare North', 'Lucky Summer', 'Korogocho'] },
      { name: 'Embakasi South', wards: ['Imara Daima', 'Kwa Njenga', 'Kwa Reuben', 'Pipeline', 'Kware'] },
      { name: 'Embakasi North', wards: ['Kariobangi North', 'Dandora Area I', 'Dandora Area Ii', 'Dandora Area Iii', 'Dandora Area Iv'] },
      { name: 'Embakasi Central', wards: ['Kayole North', 'Kayole Central', 'Kayole South', 'Komarock', 'Matopeni'] },
      { name: 'Embakasi East', wards: ['Upper Savannah', 'Lower Savannah', 'Embakasi', 'Utawala', 'Mihango'] },
      { name: 'Embakasi West', wards: ['Umoja I', 'Umoja II', 'Mowlem', 'Kariobangi South'] },
      { name: 'Makadara', wards: ['Makongeni', 'Maringo/Hamza', 'Harambee', 'Viwandani'] },
      { name: 'Kamukunji', wards: ['Pumwani', 'Eastleigh North', 'Eastleigh South', 'Airbase', 'California'] },
      { name: 'Starehe', wards: ['Nairobi Central', 'Ngara', 'Ziwani/Kariokor', 'Pangani', 'Landimawe', 'Nairobi South'] },
      { name: 'Mathare', wards: ['Hospital', 'Mabatini', 'Huruma', 'Ngei', 'Mlango Kubwa', 'Kiamaiko'] },
    ]
  }
];

export default counties;