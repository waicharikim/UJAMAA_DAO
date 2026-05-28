// src/data/counties.ts
// Source: IEBC official ward boundaries via stevehoober254/kenya-county-data
// 47 counties | 290 constituencies | 1,450 wards

interface Constituency { name: string; wards: string[] }
interface County { name: string; code: string; constituencies: Constituency[] }

const counties: County[] = [
  {
    name: 'Mombasa',
    code: '001',
    constituencies: [
      {
        name: 'Changamwe',
        wards: ['Port Reitz', 'Kipevu', 'Airport', 'Changamwe', 'Chaani'],
      },
      {
        name: 'Jomvu',
        wards: ['Jomvu Kuu', 'Miritini', 'Mikindani'],
      },
      {
        name: 'Kisauni',
        wards: [
          'Mjambere',
          'Junda',
          'Bamburi',
          'Mwakirunge',
          'Mtopanga',
          'Magogoni',
          'Shanzu',
        ],
      },
      {
        name: 'Nyali',
        wards: [
          'Frere Town',
          'Ziwa La Ngombe',
          'Mkomani',
          'Kongowea',
          'Kadzandani',
        ],
      },
      {
        name: 'Likoni',
        wards: ['Mtongwe', 'Shika Adabu', 'Bofu', 'Likoni', 'Timbwani'],
      },
      {
        name: 'Mvita',
        wards: [
          'Mji Wa Kale/makadara',
          'Tudor',
          'Tononoka',
          'Shimanzi/ganjoni',
          'Majengo',
        ],
      },
    ],
  },
  {
    name: 'Kwale',
    code: '002',
    constituencies: [
      {
        name: 'Msambweni',
        wards: ['Gombato Bongwe', 'Ukunda', 'Kinondo', 'Ramisi'],
      },
      {
        name: 'Lungalunga',
        wards: ['Pongwe/kikoneni', 'Dzombo', 'Mwereni', 'Vanga'],
      },
      {
        name: 'Matuga',
        wards: ['Tsimba Golini', 'Waa', 'Tiwi', 'Kubo South', 'Mkongani'],
      },
      {
        name: 'Kinango',
        wards: [
          'Ndavaya',
          'Puma',
          'Kinango',
          'Mackinnon Road',
          'Chengoni/samburu',
          'Mwavumbo',
          'Kasemeni',
        ],
      },
    ],
  },
  {
    name: 'Kilifi',
    code: '003',
    constituencies: [
      {
        name: 'Kilifi North',
        wards: [
          'Tezo',
          'Sokoni',
          'Kibarani',
          'Dabaso',
          'Matsangoni',
          'Watamu',
          'Mnarani',
        ],
      },
      {
        name: 'Kilifi South',
        wards: ['Junju', 'Mwarakaya', 'Shimo La Tewa', 'Chasimba', 'Mtepeni'],
      },
      {
        name: 'Kaloleni',
        wards: ['Mariakani', 'Kayafungo', 'Kaloleni', 'Mwanamwinga'],
      },
      {
        name: 'Rabai',
        wards: ['Mwawesa', 'Ruruma', 'Kambe/ribe', 'Rabai/kisurutini'],
      },
      {
        name: 'Ganze',
        wards: ['Ganze', 'Bamba', 'Jaribuni', 'Sokoke'],
      },
      {
        name: 'Malindi',
        wards: ['Jilore', 'Kakuyuni', 'Ganda', 'Malindi Town', 'Shella'],
      },
      {
        name: 'Magarini',
        wards: ['Marafa', 'Magarini', 'Gongoni', 'Adu', 'Garashi', 'Sabaki'],
      },
    ],
  },
  {
    name: 'Tana River',
    code: '004',
    constituencies: [
      {
        name: 'Garsen',
        wards: [
          'Kipini East',
          'Garsen South',
          'Kipini West',
          'Garsen Central',
          'Garsen West',
          'Garsen North',
        ],
      },
      {
        name: 'Galole',
        wards: ['Kinakomba', 'Mikinduni', 'Chewani', 'Wayu'],
      },
      {
        name: 'Bura',
        wards: ['Chewele', 'Hirimani', 'Bangale', 'Sala', 'Madogo'],
      },
    ],
  },
  {
    name: 'Lamu',
    code: '005',
    constituencies: [
      {
        name: 'Lamu East',
        wards: ['Faza', 'Kiunga', 'Basuba'],
      },
      {
        name: 'Lamu West',
        wards: [
          'Shella',
          'Mkomani',
          'Hindi',
          'Mkunumbi',
          'Hongwe',
          'Witu',
          'Bahari',
        ],
      },
    ],
  },
  {
    name: 'Taita Taveta',
    code: '006',
    constituencies: [
      {
        name: 'Taveta',
        wards: ['Chala', 'Mahoo', 'Bomani', 'Mboghoni', 'Mata'],
      },
      {
        name: 'Wundanyi',
        wards: [
          'Wundanyi/mbale',
          'Werugha',
          'Wumingu/kishushe',
          'Mwanda/mgange',
        ],
      },
      {
        name: 'Mwatate',
        wards: ['Ronge', 'Mwatate', 'Bura', 'Chawia', 'Wusi/kishamba'],
      },
      {
        name: 'Voi',
        wards: [
          'Mbololo',
          'Sagalla',
          'Kaloleni',
          'Marungu',
          'Kasigau',
          'Ngolia',
        ],
      },
    ],
  },
  {
    name: 'Garissa',
    code: '007',
    constituencies: [
      {
        name: 'Garissa Township',
        wards: ['Waberi', 'Galbet', 'Township', 'Iftin'],
      },
      {
        name: 'Balambala',
        wards: ['Balambala', 'Danyere', 'Jara Jara', 'Saka', 'Sankuri'],
      },
      {
        name: 'Lagdera',
        wards: [
          'Modogashe',
          'Benane',
          'Goreale',
          'Maalimin',
          'Sabena',
          'Baraki',
        ],
      },
      {
        name: 'Dadaab',
        wards: [
          'Dertu',
          'Dadaab',
          'Labasigale',
          'Damajale',
          'Liboi',
          'Abakaile',
        ],
      },
      {
        name: 'Fafi',
        wards: ['Bura', 'Dekaharia', 'Jarajila', 'Fafi', 'Nanighi'],
      },
      {
        name: 'Ijara',
        wards: ['Hulugho', 'Sangailu', 'Ijara', 'Masalani'],
      },
    ],
  },
  {
    name: 'Wajir',
    code: '008',
    constituencies: [
      {
        name: 'Wajir North',
        wards: [
          'Gurar',
          'Bute',
          'Korondile',
          'Malkagufu',
          'Batalu',
          'Danaba',
          'Godoma',
        ],
      },
      {
        name: 'Wajir East',
        wards: ['Wagberi', 'Township', 'Barwago', 'Khorof/harar'],
      },
      {
        name: 'Tarbaj',
        wards: ['Elben', 'Sarman', 'Tarbaj', 'Wargadud'],
      },
      {
        name: 'Wajir West',
        wards: [
          'Arbajahan',
          'Hadado/athibohol',
          'Adamasajide',
          'Ganyure/wagalla',
        ],
      },
      {
        name: 'Eldas',
        wards: ['Eldas', 'Della', 'Lakoley South/basir', 'Elnur/tula Tula'],
      },
      {
        name: 'Wajir South',
        wards: [
          'Benane',
          'Burder',
          'Dadaja Bulla',
          'Habasswein',
          'Lagboghol South',
          'Ibrahim Ure',
          'Diif',
        ],
      },
    ],
  },
  {
    name: 'Mandera',
    code: '009',
    constituencies: [
      {
        name: 'Mandera West',
        wards: ['Takaba South', 'Takaba', 'Lagsure', 'Dandu', 'Gither'],
      },
      {
        name: 'Banissa',
        wards: ['Banissa', 'Derkhale', 'Guba', 'Malkamari', 'Kiliwehiri'],
      },
      {
        name: 'Mandera North',
        wards: ['Ashabito', 'Guticha', 'Morothile', 'Rhamu', 'Rhamu-dimtu'],
      },
      {
        name: 'Mandera South',
        wards: [
          'Wargadud',
          'Kutulo',
          'Elwak South',
          'Elwak North',
          'Shimbir Fatuma',
        ],
      },
      {
        name: 'Mandera East',
        wards: ['Arabia', 'Bulla Mpya', 'Khalalio', 'Neboi', 'Township'],
      },
      {
        name: 'Lafey',
        wards: ['Sala', 'Fino', 'Lafey', 'Waranqara', 'Alango Gof'],
      },
    ],
  },
  {
    name: 'Marsabit',
    code: '010',
    constituencies: [
      {
        name: 'Moyale',
        wards: [
          'Butiye',
          'Sololo',
          'Heillu/manyatta',
          'Golbo',
          'Moyale Township',
          'Uran',
          'Obbu',
        ],
      },
      {
        name: 'North Horr',
        wards: ['Dukana', 'Maikona', 'Turbi', 'North Horr', 'Illeret'],
      },
      {
        name: 'Saku',
        wards: ['Sagante/jaldesa', 'Karare', 'Marsabit Central'],
      },
      {
        name: 'Laisamis',
        wards: [
          'Loiyangalani',
          'Kargi/south Horr',
          'Korr/ngurunit',
          'Logo Logo',
          'Laisamis',
        ],
      },
    ],
  },
  {
    name: 'Isiolo',
    code: '011',
    constituencies: [
      {
        name: 'Isiolo North',
        wards: [
          'Wabera',
          'Bulla Pesa',
          'Chari',
          'Cherab',
          'Ngare Mara',
          'Burat',
          'Oldo/nyiro',
        ],
      },
      {
        name: 'Isiolo South',
        wards: ['Garbatulla', 'Kinna', 'Sericho'],
      },
    ],
  },
  {
    name: 'Meru',
    code: '012',
    constituencies: [
      {
        name: 'Igembe South',
        wards: [
          'Maua',
          'Kiegoi/antubochiu',
          'Athiru Gaiti',
          'Akachiu',
          'Kanuni',
        ],
      },
      {
        name: 'Igembe Central',
        wards: [
          'Akirangondu',
          'Athiru Ruujine',
          'Igembe East',
          'Njia',
          'Kangeta',
        ],
      },
      {
        name: 'Igembe North',
        wards: [
          'Antuambui',
          'Ntunene',
          'Antubetwe Kiongo',
          'Naathu',
          'Amwathi',
        ],
      },
      {
        name: 'Tigania West',
        wards: ['Athwana', 'Akithii', 'Kianjai', 'Nkomo', 'Mbeu'],
      },
      {
        name: 'Tigania East',
        wards: ['Thangatha', 'Mikinduri', 'Kiguchwa', 'Muthara', 'Karama'],
      },
      {
        name: 'North Imenti',
        wards: [
          'Municipality',
          'Ntima East',
          'Ntima West',
          'Nyaki West',
          'Nyaki East',
        ],
      },
      {
        name: 'Buuri',
        wards: [
          'Timau',
          'Kisima',
          'Kiirua/naari',
          'Ruiri/rwarera',
          'Kibirichia',
        ],
      },
      {
        name: 'Central Imenti',
        wards: [
          'Mwanganthia',
          'Abothuguchi Central',
          'Abothuguchi West',
          'Kiagu',
        ],
      },
      {
        name: 'South Imenti',
        wards: [
          'Mitunguu',
          'Igoji East',
          'Igoji West',
          'Abogeta East',
          'Abogeta West',
          'Nkuene',
        ],
      },
    ],
  },
  {
    name: 'Tharaka Nithi',
    code: '013',
    constituencies: [
      {
        name: 'Maara',
        wards: ['Mitheru', 'Muthambi', 'Mwimbi', 'Ganga', 'Chogoria'],
      },
      {
        name: 'Chuka/igambangombe',
        wards: ['Mariani', 'Karingani', 'Magumoni', 'Mugwe', 'Igambangombe'],
      },
      {
        name: 'Tharaka',
        wards: ['Gatunga', 'Mukothima', 'Nkondi', 'Chiakariga', 'Marimanti'],
      },
    ],
  },
  {
    name: 'Embu',
    code: '014',
    constituencies: [
      {
        name: 'Manyatta',
        wards: [
          'Ruguru/ngandori',
          'Kithimu',
          'Nginda',
          'Mbeti North',
          'Kirimari',
          'Gaturi South',
        ],
      },
      {
        name: 'Runyenjes',
        wards: [
          'Gaturi North',
          'Kagaari South',
          'Central  Ward',
          'Kagaari North',
          'Kyeni North',
          'Kyeni South',
        ],
      },
      {
        name: 'Mbeere South',
        wards: ['Mwea', 'Makima', 'Mbeti South', 'Mavuria', 'Kiambere'],
      },
      {
        name: 'Mbeere North',
        wards: ['Nthawa', 'Muminji', 'Evurore'],
      },
    ],
  },
  {
    name: 'Kitui',
    code: '015',
    constituencies: [
      {
        name: 'Mwingi North',
        wards: ['Ngomeni', 'Kyuso', 'Mumoni', 'Tseikuru', 'Tharaka'],
      },
      {
        name: 'Mwingi West',
        wards: ['Kyome/thaana', 'Nguutani', 'Migwani', 'Kiomo/kyethani'],
      },
      {
        name: 'Mwingi Central',
        wards: ['Central', 'Kivou', 'Nguni', 'Nuu', 'Mui', 'Waita'],
      },
      {
        name: 'Kitui West',
        wards: ['Mutonguni', 'Kauwi', 'Matinyani', 'Kwa Mutonga/kithumula'],
      },
      {
        name: 'Kitui Rural',
        wards: ['Kisasi', 'Mbitini', 'Kwavonza/yatta', 'Kanyangi'],
      },
      {
        name: 'Kitui Central',
        wards: [
          'Miambani',
          'Township',
          'Kyangwithya West',
          'Mulango',
          'Kyangwithya East',
        ],
      },
      {
        name: 'Kitui East',
        wards: [
          'Zombe/mwitika',
          'Nzambani',
          'Chuluni',
          'Voo/kyamatu',
          'Endau/malalani',
          'Mutito/kaliku',
        ],
      },
      {
        name: 'Kitui South',
        wards: [
          'Ikanga/kyatune',
          'Mutomo',
          'Mutha',
          'Ikutha',
          'Kanziko',
          'Athi',
        ],
      },
    ],
  },
  {
    name: 'Machakos',
    code: '016',
    constituencies: [
      {
        name: 'Masinga',
        wards: [
          'Kivaa',
          'Masinga Central',
          'Ekalakala',
          'Muthesya',
          'Ndithini',
        ],
      },
      {
        name: 'Yatta',
        wards: ['Ndalani', 'Matuu', 'Kithimani', 'Ikombe', 'Katangi'],
      },
      {
        name: 'Kangundo',
        wards: [
          'Kangundo North',
          'Kangundo Central',
          'Kangundo East',
          'Kangundo West',
        ],
      },
      {
        name: 'Matungulu',
        wards: [
          'Tala',
          'Matungulu North',
          'Matungulu East',
          'Matungulu West',
          'Kyeleni',
        ],
      },
      {
        name: 'Kathiani',
        wards: [
          'Mitaboni',
          'Kathiani Central',
          'Upper Kaewa/iveti',
          'Lower Kaewa/kaani',
        ],
      },
      {
        name: 'Mavoko',
        wards: ['Athi River', 'Kinanie', 'Muthwani', 'Syokimau/mulolongo'],
      },
      {
        name: 'Machakos Town',
        wards: [
          'Kalama',
          'Mua',
          'Mutituni',
          'Machakos Central',
          'Mumbuni North',
          'Muvuti/kiima-kimwe',
          'Kola',
        ],
      },
      {
        name: 'Mwala',
        wards: [
          'Mbiuni',
          'Makutano/ Mwala',
          'Masii',
          'Muthetheni',
          'Wamunyu',
          'Kibauni',
        ],
      },
    ],
  },
  {
    name: 'Makueni',
    code: '017',
    constituencies: [
      {
        name: 'Mbooni',
        wards: [
          'Tulimani',
          'Mbooni',
          'Kithungo/kitundu',
          'Kiteta/kisau',
          'Waia-kako',
          'Kalawa',
        ],
      },
      {
        name: 'Kilome',
        wards: ['Kasikeu', 'Mukaa', 'Kiima Kiu/kalanzoni'],
      },
      {
        name: 'Kaiti',
        wards: ['Ukia', 'Kee', 'Kilungu', 'Ilima'],
      },
      {
        name: 'Makueni',
        wards: [
          'Wote',
          'Muvau/kikuumini',
          'Mavindini',
          'Kitise/kithuki',
          'Kathonzweni',
          'Nzaui/kilili/kalamba',
          'Mbitini',
        ],
      },
      {
        name: 'Kibwezi West',
        wards: [
          'Makindu',
          'Nguumo',
          'Kikumbulyu North',
          'Kikumbulyu South',
          'Nguu/masumba',
          'Emali/mulala',
        ],
      },
      {
        name: 'Kibwezi East',
        wards: ['Masongaleni', 'Mtito Andei', 'Thange', 'Ivingoni/nzambani'],
      },
    ],
  },
  {
    name: 'Nyandarua',
    code: '018',
    constituencies: [
      {
        name: 'Kinangop',
        wards: [
          'Engineer',
          'Gathara',
          'North Kinangop',
          'Murungaru',
          'Njabini\\kiburu',
          'Nyakio',
          'Githabai',
          'Magumu',
        ],
      },
      {
        name: 'Kipipiri',
        wards: ['Wanjohi', 'Kipipiri', 'Geta', 'Githioro'],
      },
      {
        name: 'Ol Kalou',
        wards: ['Karau', 'Kanjuiri Range', 'Mirangine', 'Kaimbaga', 'Rurii'],
      },
      {
        name: 'Ol Jorok',
        wards: ['Gathanji', 'Gatimu', 'Weru', 'Charagita'],
      },
      {
        name: 'Ndaragwa',
        wards: ['Leshau/pondo', 'Kiriita', 'Central', 'Shamata'],
      },
    ],
  },
  {
    name: 'Nyeri',
    code: '019',
    constituencies: [
      {
        name: 'Tetu',
        wards: ['Dedan Kimanthi', 'Wamagana', 'Aguthi-gaaki'],
      },
      {
        name: 'Kieni',
        wards: [
          'Mweiga',
          'Naromoru Kiamathaga',
          'Mwiyogo/endarasha',
          'Mugunda',
          'Gatarakwa',
          'Thegu River',
          'Kabaru',
          'Gakawa',
        ],
      },
      {
        name: 'Mathira',
        wards: [
          'Ruguru',
          'Magutu',
          'Iriaini',
          'Konyu',
          'Kirimukuyu',
          'Karatina Town',
        ],
      },
      {
        name: 'Othaya',
        wards: ['Mahiga', 'Iria-ini', 'Chinga', 'Karima'],
      },
      {
        name: 'Mukurweini',
        wards: ['Gikondi', 'Rugi', 'Mukurwe-ini West', 'Mukurwe-ini Central'],
      },
      {
        name: 'Nyeri Town',
        wards: [
          'Kiganjo/mathari',
          'Rware',
          'Gatitu/muruguru',
          'Ruringu',
          'Kamakwa/mukaro',
        ],
      },
    ],
  },
  {
    name: 'Kirinyaga',
    code: '020',
    constituencies: [
      {
        name: 'Mwea',
        wards: [
          'Mutithi',
          'Kangai',
          'Thiba',
          'Wamumu',
          'Nyangati',
          'Murinduko',
          'Gathigiriri',
          'Tebere',
        ],
      },
      {
        name: 'Gichugu',
        wards: ['Kabare', 'Baragwi', 'Njukiini', 'Ngariama', 'Karumandi'],
      },
      {
        name: 'Ndia',
        wards: ['Mukure', 'Kiine', 'Kariti'],
      },
      {
        name: 'Kirinyaga Central',
        wards: ['Mutira', 'Kanyekini', 'Kerugoya', 'Inoi'],
      },
    ],
  },
  {
    name: "Murang'a",
    code: '021',
    constituencies: [
      {
        name: 'Kangema',
        wards: ['Kanyenya-ini', 'Muguru', 'Rwathia'],
      },
      {
        name: 'Mathioya',
        wards: ['Gitugi', 'Kiru', 'Kamacharia'],
      },
      {
        name: 'Kiharu',
        wards: [
          'Wangu',
          'Mugoiri',
          'Mbiri',
          'Township',
          'Murarandia',
          'Gaturi',
        ],
      },
      {
        name: 'Kigumo',
        wards: ['Kahumbu', 'Muthithi', 'Kigumo', 'Kangari', 'Kinyona'],
      },
      {
        name: 'Maragwa',
        wards: [
          'Kimorori/wempa',
          'Makuyu',
          'Kambiti',
          'Kamahuha',
          'Ichagaki',
          'Nginda',
        ],
      },
      {
        name: 'Kandara',
        wards: [
          'Ngararia',
          'Muruka',
          'Kagundu-ini',
          'Gaichanjiru',
          'Ithiru',
          'Ruchu',
        ],
      },
      {
        name: 'Gatanga',
        wards: [
          'Ithanga',
          'Kakuzi/mitubiri',
          'Mugumo-ini',
          'Kihumbu-ini',
          'Gatanga',
          'Kariara',
        ],
      },
    ],
  },
  {
    name: 'Kiambu',
    code: '022',
    constituencies: [
      {
        name: 'Gatundu South',
        wards: ['Kiamwangi', 'Kiganjo', 'Ndarugu', 'Ngenda'],
      },
      {
        name: 'Gatundu North',
        wards: ['Gituamba', 'Githobokoni', 'Chania', 'Mangu'],
      },
      {
        name: 'Juja',
        wards: ['Murera', 'Theta', 'Juja', 'Witeithie', 'Kalimoni'],
      },
      {
        name: 'Thika Town',
        wards: ['Township', 'Kamenu', 'Hospital', 'Gatuanyaga', 'Ngoliba'],
      },
      {
        name: 'Ruiru',
        wards: [
          'Gitothua',
          'Biashara',
          'Gatongora',
          'Kahawa Sukari',
          'Kahawa Wendani',
          'Kiuu',
          'Mwiki',
          'Mwihoko',
        ],
      },
      {
        name: 'Githunguri',
        wards: ['Githunguri', 'Githiga', 'Ikinu', 'Ngewa', 'Komothai'],
      },
      {
        name: 'Kiambu',
        wards: ['Tinganga', 'Ndumberi', 'Riabai', 'Township'],
      },
      {
        name: 'Kiambaa',
        wards: ['Cianda', 'Karuri', 'Ndenderu', 'Muchatha', 'Kihara'],
      },
      {
        name: 'Kabete',
        wards: ['Gitaru', 'Muguga', 'Nyadhuna', 'Kabete', 'Uthiru'],
      },
      {
        name: 'Kikuyu',
        wards: ['Karai', 'Nachu', 'Sigona', 'Kikuyu', 'Kinoo'],
      },
      {
        name: 'Limuru',
        wards: [
          'Bibirioni',
          'Limuru Central',
          'Ndeiya',
          'Limuru East',
          'Ngecha Tigoni',
        ],
      },
      {
        name: 'Lari',
        wards: ['Kinale', 'Kijabe', 'Nyanduma', 'Kamburu', 'Lari/kirenga'],
      },
    ],
  },
  {
    name: 'Turkana',
    code: '023',
    constituencies: [
      {
        name: 'Turkana North',
        wards: [
          'Kaeris',
          'Lake Zone',
          'Lapur',
          'Kaaleng/kaikor',
          'Kibish',
          'Nakalale',
        ],
      },
      {
        name: 'Turkana West',
        wards: [
          'Kakuma',
          'Lopur',
          'Letea',
          'Songot',
          'Kalobeyei',
          'Lokichoggio',
          'Nanaam',
        ],
      },
      {
        name: 'Turkana Central',
        wards: [
          'Kerio Delta',
          'Kangatotha',
          'Kalokol',
          'Lodwar Township',
          'Kanamkemer',
        ],
      },
      {
        name: 'Loima',
        wards: ['Kotaruk/lobei', 'Turkwel', 'Loima', 'Lokiriama/lorengippi'],
      },
      {
        name: 'Turkana South',
        wards: ['Kaputir', 'Katilu', 'Lobokat', 'Kalapata', 'Lokichar'],
      },
      {
        name: 'Turkana East',
        wards: ['Kapedo/napeitom', 'Katilia', 'Lokori/kochodin'],
      },
    ],
  },
  {
    name: 'West Pokot',
    code: '024',
    constituencies: [
      {
        name: 'Kapenguria',
        wards: ['Riwo', 'Kapenguria', 'Mnagei', 'Siyoi', 'Endugh', 'Sook'],
      },
      {
        name: 'Sigor',
        wards: ['Sekerr', 'Masool', 'Lomut', 'Weiwei'],
      },
      {
        name: 'Kacheliba',
        wards: ['Suam', 'Kodich', 'Kasei', 'Kapchok', 'Kiwawa', 'Alale'],
      },
      {
        name: 'Pokot South',
        wards: ['Chepareria', 'Batei', 'Lelan', 'Tapach'],
      },
    ],
  },
  {
    name: 'Samburu',
    code: '025',
    constituencies: [
      {
        name: 'Samburu West',
        wards: ['Lodokejek', 'Suguta Marmar', 'Maralal', 'Loosuk', 'Poro'],
      },
      {
        name: 'Samburu North',
        wards: [
          'El-barta',
          'Nachola',
          'Ndoto',
          'Nyiro',
          'Angata Nanyokie',
          'Baawa',
        ],
      },
      {
        name: 'Samburu East',
        wards: ['Waso', 'Wamba West', 'Wamba East', 'Wamba North'],
      },
    ],
  },
  {
    name: 'Trans Nzoia',
    code: '026',
    constituencies: [
      {
        name: 'Kwanza',
        wards: ['Kapomboi', 'Kwanza', 'Keiyo', 'Bidii'],
      },
      {
        name: 'Endebess',
        wards: ['Chepchoina', 'Endebess', 'Matumbei'],
      },
      {
        name: 'Saboti',
        wards: ['Kinyoro', 'Matisi', 'Tuwani', 'Saboti', 'Machewa'],
      },
      {
        name: 'Kiminini',
        wards: [
          'Kiminini',
          'Waitaluk',
          'Sirende',
          'Hospital',
          'Sikhendu',
          'Nabiswa',
        ],
      },
      {
        name: 'Cherangany',
        wards: [
          'Sinyerere',
          'Makutano',
          'Kaplamai',
          'Motosiet',
          'Cherangany/suwerwa',
          'Chepsiro/kiptoror',
          'Sitatunga',
        ],
      },
    ],
  },
  {
    name: 'Uasin Gishu',
    code: '027',
    constituencies: [
      {
        name: 'Soy',
        wards: [
          'Mois Bridge',
          'Kapkures',
          'Ziwa',
          'Segero/barsombe',
          'Kipsomba',
          'Soy',
          'Kuinet/kapsuswa',
        ],
      },
      {
        name: 'Turbo',
        wards: [
          'Ngenyilel',
          'Tapsagoi',
          'Kamagut',
          'Kiplombe',
          'Kapsaos',
          'Huruma',
        ],
      },
      {
        name: 'Moiben',
        wards: ['Tembelio', 'Sergoit', 'Karuna/meibeki', 'Moiben', 'Kimumu'],
      },
      {
        name: 'Ainabkoi',
        wards: ['Kapsoya', 'Kaptagat', 'Ainabkoi/olare'],
      },
      {
        name: 'Kapseret',
        wards: ['Simat/kapseret', 'Kipkenyo', 'Ngeria', 'Megun', 'Langas'],
      },
      {
        name: 'Kesses',
        wards: [
          'Racecourse',
          'Cheptiret/kipchamo',
          'Tulwet/chuiyat',
          'Tarakwa',
        ],
      },
    ],
  },
  {
    name: 'Elgeyo Marakwet',
    code: '028',
    constituencies: [
      {
        name: 'Marakwet East',
        wards: ['Kapyego', 'Sambirir', 'Endo', 'Embobut / Embulot'],
      },
      {
        name: 'Marakwet West',
        wards: [
          'Lelan',
          'Sengwer',
          'Cherangany/chebororwa',
          'Moiben/kuserwo',
          'Kapsowar',
          'Arror',
        ],
      },
      {
        name: 'Keiyo North',
        wards: ['Emsoo', 'Kamariny', 'Kapchemutwa', 'Tambach'],
      },
      {
        name: 'Keiyo South',
        wards: [
          'Kaptarakwa',
          'Chepkorio',
          'Soy North',
          'Soy South',
          'Kabiemit',
          'Metkei',
        ],
      },
    ],
  },
  {
    name: 'Nandi',
    code: '029',
    constituencies: [
      {
        name: 'Tinderet',
        wards: ['Songhor/soba', 'Tindiret', 'Chemelil/chemase', 'Kapsimotwo'],
      },
      {
        name: 'Aldai',
        wards: [
          'Kabwareng',
          'Terik',
          'Kemeloi-maraba',
          'Kobujoi',
          'Kaptumo-kaboi',
          'Koyo-ndurio',
        ],
      },
      {
        name: 'Nandi Hills',
        wards: ['Nandi Hills', 'Chepkunyuk', 'Ollessos', 'Kapchorua'],
      },
      {
        name: 'Chesumei',
        wards: [
          'Chemundu/kapngetuny',
          'Kosirai',
          'Lelmokwo/ngechek',
          'Kaptel/kamoiywo',
          'Kiptuya',
        ],
      },
      {
        name: 'Emgwen',
        wards: ['Chepkumia', 'Kapkangani', 'Kapsabet', 'Kilibwoni'],
      },
      {
        name: 'Mosop',
        wards: [
          'Chepterwai',
          'Kipkaren',
          'Kurgung/surungai',
          'Kabiyet',
          'Ndalat',
          'Kabisaga',
          'Sangalo/kebulonik',
        ],
      },
    ],
  },
  {
    name: 'Baringo',
    code: '030',
    constituencies: [
      {
        name: 'Tiaty',
        wards: [
          'Tirioko',
          'Kolowa',
          'Ribkwo',
          'Silale',
          'Loiyamorock',
          'Tangulbei/korossi',
          'Churo/amaya',
        ],
      },
      {
        name: 'Baringo  North',
        wards: [
          'Barwessa',
          'Kabartonjo',
          'Saimo/kipsaraman',
          'Saimo/soi',
          'Bartabwa',
        ],
      },
      {
        name: 'Baringo Central',
        wards: ['Kabarnet', 'Sacho', 'Tenges', 'Ewalel/chapchap', 'Kapropita'],
      },
      {
        name: 'Baringo South',
        wards: ['Marigat', 'Ilchamus', 'Mochongoi', 'Mukutani'],
      },
      {
        name: 'Mogotio',
        wards: ['Mogotio', 'Emining', 'Kisanana'],
      },
      {
        name: 'Eldama Ravine',
        wards: [
          'Lembus',
          'Lembus Kwen',
          'Ravine',
          'Mumberes/maji Mazuri',
          'Lembus/perkerra',
          'Koibatek',
        ],
      },
    ],
  },
  {
    name: 'Laikipia',
    code: '031',
    constituencies: [
      {
        name: 'Laikipia West',
        wards: [
          'Ol-moran',
          'Rumuruti Township',
          'Githiga',
          'Marmanet',
          'Igwamiti',
          'Salama',
        ],
      },
      {
        name: 'Laikipia East',
        wards: ['Ngobit', 'Tigithi', 'Thingithu', 'Nanyuki', 'Umande'],
      },
      {
        name: 'Laikipia North',
        wards: ['Sosian', 'Segera', 'Mugogodo West', 'Mugogodo East'],
      },
    ],
  },
  {
    name: 'Nakuru',
    code: '032',
    constituencies: [
      {
        name: 'Molo',
        wards: ['Mariashoni', 'Elburgon', 'Turi', 'Molo'],
      },
      {
        name: 'Njoro',
        wards: ['Mau Narok', 'Mauche', 'Kihingo', 'Nessuit', 'Lare', 'Njoro'],
      },
      {
        name: 'Naivasha',
        wards: [
          'Biashara',
          'Hells Gate',
          'Lake View',
          'Mai Mahiu',
          'Maiella',
          'Olkaria',
          'Naivasha East',
          'Viwandani',
        ],
      },
      {
        name: 'Gilgil',
        wards: [
          'Gilgil',
          'Elementaita',
          'Mbaruk/eburu',
          'Malewa West',
          'Murindati',
        ],
      },
      {
        name: 'Kuresoi South',
        wards: ['Amalo', 'Keringet', 'Kiptagich', 'Tinet'],
      },
      {
        name: 'Kuresoi North',
        wards: ['Kiptororo', 'Nyota', 'Sirikwa', 'Kamara'],
      },
      {
        name: 'Subukia',
        wards: ['Subukia', 'Waseges', 'Kabazi'],
      },
      {
        name: 'Rongai',
        wards: ['Menengai West', 'Soin', 'Visoi', 'Mosop', 'Solai'],
      },
      {
        name: 'Bahati',
        wards: ['Dundori', 'Kabatini', 'Kiamaina', 'Lanet/umoja', 'Bahati'],
      },
      {
        name: 'Nakuru Town West',
        wards: ['Barut', 'London', 'Kaptembwo', 'Kapkures', 'Rhoda', 'Shaabab'],
      },
      {
        name: 'Nakuru Town East',
        wards: ['Biashara', 'Kivumbini', 'Flamingo', 'Menengai', 'Nakuru East'],
      },
    ],
  },
  {
    name: 'Narok',
    code: '033',
    constituencies: [
      {
        name: 'Kilgoris',
        wards: [
          'Kilgoris Central',
          'Keyian',
          'Angata Barikoi',
          'Shankoe',
          'Kimintet',
          'Lolgorian',
        ],
      },
      {
        name: 'Emurua Dikirr',
        wards: ['Ilkerin', 'Ololmasani', 'Mogondo', 'Kapsasian'],
      },
      {
        name: 'Narok North',
        wards: [
          'Olpusimoru',
          'Olokurto',
          'Narok Town',
          'Nkareta',
          'Olorropil',
          'Melili',
        ],
      },
      {
        name: 'Narok East',
        wards: ['Mosiro', 'Ildamat', 'Keekonyokie', 'Suswa'],
      },
      {
        name: 'Narok South',
        wards: [
          'Majimoto/naroosura',
          'Ololulunga',
          'Melelo',
          'Loita',
          'Sogoo',
          'Sagamian',
        ],
      },
      {
        name: 'Narok West',
        wards: ['Ilmotiok', 'Mara', 'Siana', 'Naikarra'],
      },
    ],
  },
  {
    name: 'Kajiado',
    code: '034',
    constituencies: [
      {
        name: 'Kajiado North',
        wards: ['Olkeri', 'Ongata Rongai', 'Nkaimurunya', 'Oloolua', 'Ngong'],
      },
      {
        name: 'Kajiado Central',
        wards: [
          'Purko',
          'Ildamat',
          'Dalalekutuk',
          'Matapato North',
          'Matapato South',
        ],
      },
      {
        name: 'Kajiado East',
        wards: [
          'Kaputiei North',
          'Kitengela',
          'Oloosirkon/sholinke',
          'Kenyawa-poka',
          'Imaroro',
        ],
      },
      {
        name: 'Kajiado West',
        wards: [
          'Keekonyokie',
          'Iloodokilani',
          'Magadi',
          'Ewuaso Oonkidongi',
          'Mosiro',
        ],
      },
      {
        name: 'Kajiado South',
        wards: [
          'Entonet/lenkisim',
          'Mbirikani/eselenkei',
          'Kuku',
          'Rombo',
          'Kimana',
        ],
      },
    ],
  },
  {
    name: 'Kericho',
    code: '035',
    constituencies: [
      {
        name: 'Kipkelion East',
        wards: ['Londiani', 'Kedowa/kimugul', 'Chepseon', 'Tendeno/sorget'],
      },
      {
        name: 'Kipkelion West',
        wards: ['Kunyak', 'Kamasian', 'Kipkelion', 'Chilchila'],
      },
      {
        name: 'Ainamoi',
        wards: [
          'Kapsoit',
          'Ainamoi',
          'Kapkugerwet',
          'Kipchebor',
          'Kipchimchim',
          'Kapsaos',
        ],
      },
      {
        name: 'Bureti',
        wards: [
          'Kisiara',
          'Tebesonik',
          'Cheboin',
          'Chemosot',
          'Litein',
          'Cheplanget',
          'Kapkatet',
        ],
      },
      {
        name: 'Belgut',
        wards: [
          'Waldai',
          'Kabianga',
          'Cheptororiet/seretut',
          'Chaik',
          'Kapsuser',
        ],
      },
      {
        name: 'Sigowet/soin',
        wards: ['Sigowet', 'Kaplelartet', 'Soliat', 'Soin'],
      },
    ],
  },
  {
    name: 'Bomet',
    code: '036',
    constituencies: [
      {
        name: 'Sotik',
        wards: [
          'Ndanai/abosi',
          'Chemagel',
          'Kipsonoi',
          'Kapletundo',
          'Rongena/manaret',
        ],
      },
      {
        name: 'Chepalungu',
        wards: ['Kongasis', 'Nyangores', 'Sigor', 'Chebunyo', 'Siongiroi'],
      },
      {
        name: 'Bomet East',
        wards: ['Merigi', 'Kembu', 'Longisa', 'Kipreres', 'Chemaner'],
      },
      {
        name: 'Bomet Central',
        wards: [
          'Silibwet Township',
          'Ndaraweta',
          'Singorwet',
          'Chesoen',
          'Mutarakwa',
        ],
      },
      {
        name: 'Konoin',
        wards: ['Chepchabas', 'Kimulot', 'Mogogosiek', 'Boito', 'Embomos'],
      },
    ],
  },
  {
    name: 'Kakamega',
    code: '037',
    constituencies: [
      {
        name: 'Lugari',
        wards: [
          'Mautuma',
          'Lugari',
          'Lumakanda',
          'Chekalini',
          'Chevaywa',
          'Lwandeti',
        ],
      },
      {
        name: 'Likuyani',
        wards: ['Likuyani', 'Sango', 'Kongoni', 'Nzoia', 'Sinoko'],
      },
      {
        name: 'Malava',
        wards: [
          'West Kabras',
          'Chemuche',
          'East Kabras',
          'Butali/chegulo',
          'Manda-shivanga',
          'Shirugu-mugai',
          'South Kabras',
        ],
      },
      {
        name: 'Lurambi',
        wards: [
          'Butsotso East',
          'Butsotso South',
          'Butsotso Central',
          'Sheywe',
          'Mahiakalo',
          'Shirere',
        ],
      },
      {
        name: 'Navakholo',
        wards: [
          'Ingostse-mathia',
          'Shinoyi-shikomari-esumeyia',
          'Bunyala West',
          'Bunyala East',
          'Bunyala Central',
        ],
      },
      {
        name: 'Mumias West',
        wards: ['Mumias Central', 'Mumias North', 'Etenje', 'Musanda'],
      },
      {
        name: 'Mumias East',
        wards: ['Lusheya/lubinu', 'Malaha/isongo/makunga', 'East Wanga'],
      },
      {
        name: 'Matungu',
        wards: ['Koyonzo', 'Kholera', 'Khalaba', 'Mayoni', 'Namamali'],
      },
      {
        name: 'Butere',
        wards: [
          'Marama West',
          'Marama Central',
          'Marenyo - Shianda',
          'Marama North',
          'Marama South',
        ],
      },
      {
        name: 'Khwisero',
        wards: ['Kisa North', 'Kisa East', 'Kisa West', 'Kisa Central'],
      },
      {
        name: 'Shinyalu',
        wards: [
          'Isukha North',
          'Murhanda',
          'Isukha Central',
          'Isukha South',
          'Isukha East',
          'Isukha West',
        ],
      },
      {
        name: 'Ikolomani',
        wards: [
          'Idakho South',
          'Idakho East',
          'Idakho North',
          'Idakho Central',
        ],
      },
    ],
  },
  {
    name: 'Vihiga',
    code: '038',
    constituencies: [
      {
        name: 'Vihiga',
        wards: [
          'Lugaga-wamuluma',
          'South Maragoli',
          'Central Maragoli',
          'Mungoma',
        ],
      },
      {
        name: 'Sabatia',
        wards: [
          'Lyaduywa/izava',
          'West Sabatia',
          'Chavakali',
          'North Maragoli',
          'Wodanga',
          'Busali',
        ],
      },
      {
        name: 'Hamisi',
        wards: [
          'Shiru',
          'Gisambai',
          'Shamakhokho',
          'Banja',
          'Muhudu',
          'Tambua',
          'Jepkoyai',
        ],
      },
      {
        name: 'Luanda',
        wards: [
          'Luanda Township',
          'Wemilabi',
          'Mwibona',
          'Luanda South',
          'Emabungo',
        ],
      },
      {
        name: 'Emuhaya',
        wards: ['North East Bunyore', 'Central Bunyore', 'West Bunyore'],
      },
    ],
  },
  {
    name: 'Bungoma',
    code: '039',
    constituencies: [
      {
        name: 'Mt. Elgon',
        wards: [
          'Cheptais',
          'Chesikaki',
          'Chepyuk',
          'Kapkateny',
          'Kaptama',
          'Elgon',
        ],
      },
      {
        name: 'Sirisia',
        wards: ['Namwela', 'Malakisi/south Kulisiru', 'Lwandanyi'],
      },
      {
        name: 'Kabuchai',
        wards: ['Kabuchai/chwele', 'West Nalondo', 'Bwake/luuya', 'Mukuyuni'],
      },
      {
        name: 'Bumula',
        wards: [
          'South Bukusu',
          'Bumula',
          'Khasoko',
          'Kabula',
          'Kimaeti',
          'West Bukusu',
          'Siboti',
        ],
      },
      {
        name: 'Kanduyi',
        wards: [
          'Bukembe West',
          'Bukembe East',
          'Township',
          'Khalaba',
          'Musikoma',
          'East Sangalo',
          'Marakaru/tuuti',
          'West Sangalo',
        ],
      },
      {
        name: 'Webuye East',
        wards: ['Mihuu', 'Ndivisi', 'Maraka'],
      },
      {
        name: 'Webuye West',
        wards: ['Misikhu', 'Sitikho', 'Matulo', 'Bokoli'],
      },
      {
        name: 'Kimilili',
        wards: ['Kibingei', 'Kimilili', 'Maeni', 'Kamukuywa'],
      },
      {
        name: 'Tongaren',
        wards: [
          'Mbakalo',
          'Naitiri/kabuyefwe',
          'Milima',
          'Ndalu/ Tabani',
          'Tongaren',
          'Soysambu/ Mitua',
        ],
      },
    ],
  },
  {
    name: 'Busia',
    code: '040',
    constituencies: [
      {
        name: 'Teso North',
        wards: [
          'Malaba Central',
          'Malaba North',
          'Angurai South',
          'Angurai North',
          'Angurai East',
          'Malaba South',
        ],
      },
      {
        name: 'Teso South',
        wards: [
          'Angorom',
          'Chakol South',
          'Chakol North',
          'Amukura West',
          'Amukura East',
          'Amukura Central',
        ],
      },
      {
        name: 'Nambale',
        wards: [
          'Nambale Township',
          'Bukhayo North/waltsi',
          'Bukhayo East',
          'Bukhayo Central',
        ],
      },
      {
        name: 'Matayos',
        wards: [
          'Bukhayo West',
          'Mayenje',
          'Matayos South',
          'Busibwabo',
          'Burumba',
        ],
      },
      {
        name: 'Butula',
        wards: [
          'Marachi West',
          'Kingandole',
          'Marachi Central',
          'Marachi East',
          'Marachi North',
          'Elugulu',
        ],
      },
      {
        name: 'Funyula',
        wards: ['Namboboto Nambuku', 'Nangina', 'Agenga Nanguba', 'Bwiri'],
      },
      {
        name: 'Budalangi',
        wards: [
          'Bunyala Central',
          'Bunyala North',
          'Bunyala West',
          'Bunyala South',
        ],
      },
    ],
  },
  {
    name: 'Siaya',
    code: '041',
    constituencies: [
      {
        name: 'Ugenya',
        wards: ['West Ugenya', 'Ukwala', 'North Ugenya', 'East Ugenya'],
      },
      {
        name: 'Ugunja',
        wards: ['Sidindi', 'Sigomere', 'Ugunja'],
      },
      {
        name: 'Alego Usonga',
        wards: [
          'Usonga',
          'West Alego',
          'Central Alego',
          'Siaya Township',
          'North Alego',
          'South East Alego',
        ],
      },
      {
        name: 'Gem',
        wards: [
          'North Gem',
          'West Gem',
          'Central Gem',
          'Yala Township',
          'East Gem',
          'South Gem',
        ],
      },
      {
        name: 'Bondo',
        wards: [
          'West Yimbo',
          'Central Sakwa',
          'South Sakwa',
          'Yimbo East',
          'West Sakwa',
          'North Sakwa',
        ],
      },
      {
        name: 'Rarieda',
        wards: [
          'East Asembo',
          'West Asembo',
          'North Uyoma',
          'South Uyoma',
          'West Uyoma',
        ],
      },
    ],
  },
  {
    name: 'Kisumu',
    code: '042',
    constituencies: [
      {
        name: 'Kisumu East',
        wards: [
          'Kajulu',
          'Kolwa East',
          'Manyatta B',
          'Nyalenda A',
          'Kolwa Central',
        ],
      },
      {
        name: 'Kisumu West',
        wards: [
          'South West Kisumu',
          'Central Kisumu',
          'Kisumu North',
          'West Kisumu',
          'North West Kisumu',
        ],
      },
      {
        name: 'Kisumu Central',
        wards: [
          'Railways',
          'Migosi',
          'Shaurimoyo Kaloleni',
          'Market Milimani',
          'Kondele',
          'Nyalenda B',
        ],
      },
      {
        name: 'Seme',
        wards: ['West Seme', 'Central Seme', 'East Seme', 'North Seme'],
      },
      {
        name: 'Nyando',
        wards: [
          'East Kano/wawidhi',
          'Awasi/onjiko',
          'Ahero',
          'Kabonyo/kanyagwal',
          'Kobura',
        ],
      },
      {
        name: 'Muhoroni',
        wards: [
          'Miwani',
          'Ombeyi',
          'Masogo/nyangoma',
          'Chemelil',
          'Muhoroni/koru',
        ],
      },
      {
        name: 'Nyakach',
        wards: [
          'South West Nyakach',
          'North Nyakach',
          'Central Nyakach',
          'West Nyakach',
          'South East Nyakach',
        ],
      },
    ],
  },
  {
    name: 'Homa Bay',
    code: '043',
    constituencies: [
      {
        name: 'Kasipul',
        wards: [
          'West Kasipul',
          'South Kasipul',
          'Central Kasipul',
          'East Kamagak',
          'West Kamagak',
        ],
      },
      {
        name: 'Kabondo Kasipul',
        wards: ['Kabondo East', 'Kabondo West', 'Kokwanyo/kakelo', 'Kojwach'],
      },
      {
        name: 'Karachuonyo',
        wards: [
          'West Karachuonyo',
          'North Karachuonyo',
          'Central',
          'Kanyaluo',
          'Kibiri',
          'Wangchieng',
          'Kendu Bay Town',
        ],
      },
      {
        name: 'Rangwe',
        wards: ['West Gem', 'East Gem', 'Kagan', 'Kochia'],
      },
      {
        name: 'Homa Bay Town',
        wards: [
          'Homa Bay Central',
          'Homa Bay Arujo',
          'Homa Bay West',
          'Homa Bay East',
        ],
      },
      {
        name: 'Ndhiwa',
        wards: [
          'Kwabwai',
          'Kanyadoto',
          'Kanyikela',
          'Kabuoch North',
          'Kabuoch South/pala',
          'Kanyamwa Kologi',
          'Kanyamwa Kosewe',
        ],
      },
      {
        name: 'Suba North',
        wards: [
          'Mfangano Island',
          'Rusinga Island',
          'Kasgunga',
          'Gembe',
          'Lambwe',
        ],
      },
      {
        name: 'Suba South',
        wards: [
          'Gwassi South',
          'Gwassi North',
          'Kaksingri West',
          'Ruma-kaksingri',
        ],
      },
    ],
  },
  {
    name: 'Migori',
    code: '044',
    constituencies: [
      {
        name: 'Rongo',
        wards: [
          'North Kamagambo',
          'Central Kamagambo',
          'East Kamagambo',
          'South Kamagambo',
        ],
      },
      {
        name: 'Awendo',
        wards: ['North Sakwa', 'South Sakwa', 'West Sakwa', 'Central Sakwa'],
      },
      {
        name: 'Suna East',
        wards: ['God Jope', 'Suna Central', 'Kakrao', 'Kwa'],
      },
      {
        name: 'Suna West',
        wards: ['Wiga', 'Wasweta Ii', 'Ragana-oruba', 'Wasimbete'],
      },
      {
        name: 'Uriri',
        wards: [
          'West Kanyamkago',
          'North Kanyamkago',
          'Central Kanyamkago',
          'South Kanyamkago',
          'East Kanyamkago',
        ],
      },
      {
        name: 'Nyatike',
        wards: [
          'Kachieng',
          'Kanyasa',
          'North Kadem',
          'Macalder/kanyarwanda',
          'Kaler',
          'Got Kachola',
          'Muhuru',
        ],
      },
      {
        name: 'Kuria West',
        wards: [
          'Bukira East',
          'Bukira Centrl/ikerege',
          'Isibania',
          'Makerero',
          'Masaba',
          'Tagare',
          'Nyamosense/komosoko',
        ],
      },
      {
        name: 'Kuria East',
        wards: [
          'Gokeharaka/getambwega',
          'Ntimaru West',
          'Ntimaru East',
          'Nyabasi East',
          'Nyabasi West',
        ],
      },
    ],
  },
  {
    name: 'Kisii',
    code: '045',
    constituencies: [
      {
        name: 'Bonchari',
        wards: ['Bomariba', 'Bogiakumu', 'Bomorenda', 'Riana'],
      },
      {
        name: 'South Mugirango',
        wards: [
          'Tabaka',
          'Boikanga',
          'Bogetenga',
          'Borabu / Chitago',
          'Moticho',
          'Getenga',
        ],
      },
      {
        name: 'Bomachoge Borabu',
        wards: ['Bombaba Borabu', 'Boochi Borabu', 'Bokimonge', 'Magenche'],
      },
      {
        name: 'Bobasi',
        wards: [
          'Masige West',
          'Masige East',
          'Basi Central',
          'Nyacheki',
          'Basi Bogetaorio',
          'Bobasi Chache',
          'Sameta/mokwerero',
          'Bobasi Boitangare',
        ],
      },
      {
        name: 'Bomachoge Chache',
        wards: ['Majoge Basi', 'Boochi/tendere', 'Bosoti/sengera'],
      },
      {
        name: 'Nyaribari Masaba',
        wards: ['Ichuni', 'Nyamasibi', 'Masimba', 'Gesusu', 'Kiamokama'],
      },
      {
        name: 'Nyaribari Chache',
        wards: [
          'Bobaracho',
          'Kisii Central',
          'Keumbu',
          'Kiogoro',
          'Birongo',
          'Ibeno',
        ],
      },
      {
        name: 'Kitutu Chache North',
        wards: ['Monyerero', 'Sensi', 'Marani', 'Kegogi'],
      },
      {
        name: 'Kitutu Chache South',
        wards: ['Bogusero', 'Bogeka', 'Nyakoe', 'Kitutu   Central', 'Nyatieko'],
      },
    ],
  },
  {
    name: 'Nyamira',
    code: '046',
    constituencies: [
      {
        name: 'Kitutu Masaba',
        wards: ['Rigoma', 'Gachuba', 'Kemera', 'Magombo', 'Manga', 'Gesima'],
      },
      {
        name: 'West Mugirango',
        wards: ['Nyamaiya', 'Bogichora', 'Bosamaro', 'Bonyamatuta', 'Township'],
      },
      {
        name: 'North Mugirango',
        wards: ['Itibo', 'Bomwagamo', 'Bokeira', 'Magwagwa', 'Ekerenyo'],
      },
      {
        name: 'Borabu',
        wards: ['Mekenene', 'Kiabonyoru', 'Nyansiongo', 'Esise'],
      },
    ],
  },
  {
    name: 'Nairobi',
    code: '047',
    constituencies: [
      {
        name: 'Westlands',
        wards: [
          'Kitisuru',
          'Parklands/highridge',
          'Karura',
          'Kangemi',
          'Mountain View',
        ],
      },
      {
        name: 'Dagoretti North',
        wards: ['Kilimani', 'Kawangware', 'Gatina', 'Kileleshwa', 'Kabiro'],
      },
      {
        name: 'Dagoretti South',
        wards: ['Mutu-ini', 'Ngando', 'Riruta', 'Uthiru/ruthimitu', 'Waithaka'],
      },
      {
        name: 'Langata',
        wards: [
          'Karen',
          'Nairobi West',
          'Mugumu-ini',
          'South C',
          'Nyayo Highrise',
        ],
      },
      {
        name: 'Kibra',
        wards: [
          'Laini Saba',
          'Lindi',
          'Makina',
          'Woodley/kenyatta Golf Course',
          'Sarangombe',
        ],
      },
      {
        name: 'Roysambu',
        wards: ['Githurai', 'Kahawa West', 'Zimmerman', 'Roysambu', 'Kahawa'],
      },
      {
        name: 'Kasarani',
        wards: ['Clay City', 'Mwiki', 'Kasarani', 'Njiru', 'Ruai'],
      },
      {
        name: 'Ruaraka',
        wards: [
          'Baba Dogo',
          'Utalii',
          'Mathare North',
          'Lucky Summer',
          'Korogocho',
        ],
      },
      {
        name: 'Embakasi South',
        wards: ['Imara Daima', 'Kwa Njenga', 'Kwa Reuben', 'Pipeline', 'Kware'],
      },
      {
        name: 'Embakasi North',
        wards: [
          'Kariobangi North',
          'Dandora Area I',
          'Dandora Area Ii',
          'Dandora Area Iii',
          'Dandora Area Iv',
        ],
      },
      {
        name: 'Embakasi Central',
        wards: [
          'Kayole North',
          'Kayole Central',
          'Kayole South',
          'Komarock',
          'Matopeni/spring Valley',
        ],
      },
      {
        name: 'Embakasi East',
        wards: [
          'Upper Savannah',
          'Lower Savannah',
          'Embakasi',
          'Utawala',
          'Mihango',
        ],
      },
      {
        name: 'Embakasi West',
        wards: ['Umoja I', 'Umoja Ii', 'Mowlem', 'Kariobangi South'],
      },
      {
        name: 'Makadara',
        wards: ['Maringo/hamza', 'Viwandani', 'Harambee', 'Makongeni'],
      },
      {
        name: 'Kamukunji',
        wards: [
          'Pumwani',
          'Eastleigh North',
          'Eastleigh South',
          'Airbase',
          'California',
        ],
      },
      {
        name: 'Starehe',
        wards: [
          'Nairobi Central',
          'Ngara',
          'Pangani',
          'Ziwani/kariokor',
          'Landimawe',
          'Nairobi South',
        ],
      },
      {
        name: 'Mathare',
        wards: [
          'Hospital',
          'Mabatini',
          'Huruma',
          'Ngei',
          'Mlango Kubwa',
          'Kiamaiko',
        ],
      },
    ],
  },
];

export default counties;
