// src/data/counties.ts

const counties = [
  {
    name: 'Baringo',
    code: '30',
    constituencies: [
      { name: 'Baringo Central', wards: ['Kabartonjo', 'Mumbers', 'Kisanana', 'Emsok', 'Lembus Mogotio', 'Lembus Kisiara', 'Lembus Patkor', 'Eldama Ravine', 'Majimoto', 'Ewalel'] },
      { name: 'Baringo East', wards: ['Mukutani', 'Sandai', 'Kipsaraman', 'Sogonin', 'Kabartonjo', 'Loyamorok', 'Mukutani', 'Sandai', 'Kipsaraman', 'Sogonin'] },
      { name: 'Baringo North', wards: ['Sibiloi', 'Sura', 'Kipsachir', 'Arabalai', 'Barwessa', 'Kabasis', 'Sibiloi', 'Sura', 'Kipsachir', 'Arabalai'] },
      { name: 'Baringo South', wards: ['Mochongoi', 'Mukutani', 'Sogonin', 'Koriema', 'Tiaty', 'Ribkwo', 'Mochongoi', 'Mukutani', 'Sogonin', 'Koriema'] },
      { name: 'Eldama Ravine', wards: ['Lembus Mogotio', 'Lembus Kisiara', 'Lembus Patkor', 'Eldama Ravine', 'Majimoto', 'Ewalel', 'Lembus Mogotio', 'Lembus Kisiara', 'Lembus Patkor', 'Eldama Ravine'] },
      { name: 'Mogotio', wards: ['Mogotio', 'Kisanana', 'Mumbers', 'Kabunyai', 'Lembus', 'Emsok', 'Mogotio', 'Kisanana', 'Mumbers', 'Kabunyai'] }
    ]
  },
  {
    name: 'Bomet',
    code: '36',
    constituencies: [
      { name: 'Bomet Central', wards: ['Siongiroi', 'Chemagel', 'Sogonin', 'Kabianga', 'Kipkaren', 'Longisa', 'Siongiroi', 'Chemagel', 'Sogonin', 'Kabianga'] },
      { name: 'Bomet East', wards: ['Njinampasa', 'Kongasis', 'Mugango', 'Nyangores', 'Kembu', 'Singorwet', 'Njinampasa', 'Kongasis', 'Mugango', 'Nyangores'] },
      { name: 'Chepalungu', wards: ['Chepalungu', 'Kipkelion East', 'Kipkelion West', 'Ainamoi', 'Belgut', 'Bureti', 'Chepalungu', 'Kipkelion East', 'Kipkelion West', 'Ainamoi'] },
      { name: 'Konoin', wards: ['Konoin', 'Beldet', 'Sosit', 'Ndanai', 'Sosiot', 'Kipajit', 'Konoin', 'Beldet', 'Sosit', 'Ndanai'] },
      { name: 'Sotik', wards: ['Ndanai/Abosi', 'Chemagel', 'Kipsonoi', 'Kapletundo', 'Soin/Sigowet', 'Kajiado', 'Sotik', 'Nandi Hills', 'Bomet', 'Rongai'] }
    ]
  },
  {
    name: 'Bungoma',
    code: '39',
    constituencies: [
      { name: 'Tongaren', wards: ['Mbakalo', 'Naitiri/Kabuyefwe', 'Milima', 'Ndalu/Tabani', 'Tongaren', 'Soysambu/Mitua'] },
      { name: 'Bumula', wards: ['Soth Bukusu', 'Bumula', 'Khasoko', 'Kabula', 'Kimaeti', 'West Bukusu', 'Siboti'] },
      { name: 'Kanduyi', wards: ['Bukembe West', 'Bukembe East', 'Township', 'Khalaba', 'Musikoma', 'East Sang\'alo', 'Marakaru/Tuuti', 'Sang\'alo West'] },
      { name: 'Kimilili', wards: ['Kimilili', 'Kibingei', 'Maeni', 'Kamukuywa'] },
      { name: 'Mt. Elgon', wards: ['Kaptama', 'Elgon', 'Kapkateny', 'Chepyuk', 'Chesikaki', 'Cheptais'] },
      { name: 'Sirisia', wards: ['Namwela', 'Lwadanyi', 'Malakisi/South Kulisiru'] },
      { name: 'Webuye East', wards: ['Mihuu', 'Ndivisi', 'Maraka']},
      { name: 'Webuye West', wards: ['Sitikho', 'Misikhu', 'Matulo', 'Bokoli']},
      { name: 'Kabuchai', wards: ['Kabuchai/Chwele', 'West Nalondo', 'Bwake/Luuya', 'Mukuyuni']}
    ]
  },
    {
    name: 'Busia',
    code: '40',
    constituencies: [
      { name: 'Budalangi', wards: ['Budalangi', 'Bukoba', 'Nambuku', 'Namboboto', 'Chakala', 'Lwandeti'] },
      { name: 'Butula', wards: ['Butula', 'Nambuku', 'Milenje', 'Chakala', 'Lwandeti', 'Nambuki'] },
      { name: 'Funyula', wards: ['Funyula', 'Bukoba', 'Nambuku', 'Namboboto', 'Chakala', 'Lwandeti'] },
      { name: 'Matayos', wards: ['Matayos', 'Nambuku', 'Milenje', 'Chakala', 'Lwandeti', 'Nambuki'] },
      { name: 'Nambale', wards: ['Nambale', 'Bukoba', 'Nambuku', 'Namboboto', 'Chakala', 'Lwandeti'] },
      { name: 'Teso North', wards: ['Teso North', 'Nambuku', 'Milenje', 'Chakala', 'Lwandeti', 'Nambuki'] },
      { name: 'Teso South', wards: ['Teso South', 'Bukoba', 'Nambuku', 'Namboboto', 'Chakala', 'Lwandeti'] }
    ]
  },
  {
    name: 'Elgeyo-Marakwet',
    code: '28',
    constituencies: [
      { name: 'Keiyo South', wards: ['Kipchamo', 'Sogonin', 'Koisaram', 'Kapyego', 'Kaptarakwa', 'Kapyemisa'] },
      { name: 'Keiyo East', wards: ['Ainamoi', 'Belgut', 'Kipkelion East', 'Kipkelion West', 'Soin/Sigowet', 'Kapsoit'] },
      { name: 'Marakwet West', wards: ['Lembus', 'Kipkorgot', 'Sogonin', 'Koisaram', 'Kapyego', 'Kaptarakwa'] },
      { name: 'Marakwet East', wards: ['Kapyemisa', 'Lembus', 'Kipkorgot', 'Sogonin', 'Koisaram', 'Kapyego'] }
    ]
  },
  {
    name: 'Embu',
    code: '14',
    constituencies: [
      { name: 'Manyatta', wards: ['Manyatta', 'Runyenjes', 'Gachoka', 'Siakago', 'Mbeti', 'Nginda', 'Makima', 'Kiru', 'Mugweri', 'Kagaari South'] },
      { name: 'Runyenjes', wards: ['Kagaari North', 'Mukuuri', 'Runyenjes', 'Manyatta', 'Gachoka', 'Siakago', 'Mbeti', 'Nginda', 'Makima', 'Kiru'] },
      { name: 'Gachoka', wards: ['Mugweri', 'Kagaari South', 'Kagaari North', 'Mukuuri', 'Runyenjes', 'Manyatta', 'Gachoka', 'Siakago', 'Mbeti', 'Nginda'] },
      { name: 'Siakago', wards: ['Makima', 'Kiru', 'Mugweri', 'Kagaari South', 'Kagaari North', 'Mukuuri', 'Runyenjes', 'Manyatta', 'Gachoka', 'Siakago'] }
    ]
  },
  {
    name: 'Garissa',
    code: '07',
    constituencies: [
      { name: 'Garissa Township', wards: ['Waberi', 'Iftin', 'Balal', 'Amuma', 'Galbet', 'Bula Hawa'] },
      { name: 'Balambala', wards: ['Balambala', 'Sankuri', 'Danyow Dhahabu', 'Danyow Adow', 'Danyow Gorof', 'Benane'] },
      { name: 'Lagdera', wards: ['Mod Gas', 'Dekaharia', 'Baraki', 'Jarajila', 'Saka', 'Sabena'] },
      { name: 'Dadaab', wards: ['Dadaab', 'Labasigale', 'Hagadera', 'Abakaile', 'Dertu', 'Liboi'] },
      { name: 'Fafi', wards: ['Fafi', 'Jarajila', 'Saka', 'Sabena', 'Al-Njoro', 'Nanighi'] },
      { name: 'Ijara', wards: ['Ijara', 'Masalani', 'Hulugho', 'Sangailu', 'Mbalambala', 'Kula Maisin'] }
    ]
  },
  {
    name: 'Homa Bay',
    code: '43',
    constituencies: [
      { name: 'Kasipul', wards: ['Kasipul', 'Kabondo', 'Karachuonyo', 'Rangwe', 'Homabay Town', 'Ndhiwa'] },
      { name: 'Kabondo Kasipul', wards: ['Kabondo', 'Kasipul', 'Karachuonyo', 'Rangwe', 'Homabay Town', 'Ndhiwa'] },
      { name: 'Karachuonyo', wards: ['West Karachuonyo', 'East Karachuonyo', 'West Kamagambo', 'East Kamagambo', 'West Ragen', 'East Ragen'] },
      { name: 'Rangwe', wards: ['Kataja', 'Rangwe', 'Kataja', 'Rangwe', 'Kataja', 'Rangwe'] },
      { name: 'Homabay Town', wards: ['Homabay Town', 'Kataja', 'Homabay Town', 'Kataja', 'Homabay Town', 'Kataja'] },
      { name: 'Ndhiwa', wards: ['Ndhiwa', 'Gwassi', 'Koguta', 'Gwassi', 'Koguta', 'Gwassi'] },
      { name: 'Mbita', wards: ['Mbita', 'Gwassi', 'Koguta', 'Gwassi', 'Koguta', 'Gwassi'] },
      { name: 'Suba', wards: ['Gwassi', 'Koguta', 'Gwassi', 'Koguta', 'Gwassi', 'Koguta'] }
    ]
  },
  {
    name: 'Isiolo',
    code: '11',
    constituencies: [
      { name: 'Isiolo North', wards: ['Ngare Mara', 'Lagalgal', 'Bulesa', 'Ngare Ndare', 'Chariar', 'Burat'] },
      { name: 'Isiolo South', wards: ['Oldonyiro', 'Garbatulla', 'Sericho', 'Merti', 'Kipsing Gap', 'Kandisu'] }
    ]
  },
  {
    name: 'Kajiado',
    code: '34',
    constituencies: [
      { name: 'Kajiado North', wards: ['Matapato North', 'Matapato South', 'Entonet', 'Oloosirkoni', 'Ewuaso Oo Nkidong\'oi', 'Ilbisil'] },
      { name: 'Kajiado Central', wards: ['Namanga', 'Imaroro', 'Iloodokilani', 'Eselenkei', 'Donyo Sabuk', 'Ngong'] },
      { name: 'Kajiado East', wards: ['Kitengela', 'Mbirikani', 'Mosiro', 'Ongata Rongai', 'Kiserian', 'Malaika'] },
      { name: 'Kajiado West', wards: ['Isinya', 'Rongai', 'Kajiado Town', 'Sultan Hamud', 'Chyulu', 'Mbuinzau'] }
    ]
  },
  {
    name: 'Kakamega',
    code: '37',
    constituencies: [
      { name: 'Lugari', wards: ['Lugari', 'Likuyani', 'Malava', 'Lurambi', 'Makholo', 'Mumias'] },
      { name: 'Likuyani', wards: ['Likuyani', 'Lugari', 'Malava', 'Lurambi', 'Makholo', 'Mumias'] },
      { name: 'Malava', wards: ['Malava', 'Lugari', 'Likuyani', 'Lurambi', 'Makholo', 'Mumias'] },
      { name: 'Lurambi', wards: ['Lurambi', 'Lugari', 'Likuyani', 'Malava', 'Makholo', 'Mumias'] },
      { name: 'Makholo', wards: ['Makholo', 'Lugari', 'Likuyani', 'Malava', 'Lurambi', 'Mumias'] },
      { name: 'Mumias East', wards: ['Mumias East', 'Mumias West', 'Matungu', 'Butere', 'Khwisero', 'Shinyalu'] },
      { name: 'Mumias West', wards: ['Mumias West', 'Mumias East', 'Matungu', 'Butere', 'Khwisero', 'Shinyalu'] },
      { name: 'Matungu', wards: ['Matungu', 'Mumias East', 'Mumias West', 'Butere', 'Khwisero', 'Shinyalu'] },
      { name: 'Butere', wards: ['Butere', 'Mumias East', 'Mumias West', 'Matungu', 'Khwisero', 'Shinyalu'] },
      { name: 'Khwisero', wards: ['Khwisero', 'Mumias East', 'Mumias West', 'Matungu', 'Butere', 'Shinyalu'] },
      { name: 'Shinyalu', wards: ['Shinyalu', 'Mumias East', 'Mumias West', 'Matungu', 'Butere', 'Khwisero'] },
      { name: 'Ikolomani', wards: ['Ikolomani', 'Vihiga', 'Sabatia', 'Hamisi', 'Emuhaya', 'Luanda'] }
    ]
  },
  {
    name: 'Kericho',
    code: '35',
    constituencies: [
      { name: 'Ainamoi', wards: ['Ainamoi', 'Belgut', 'Kipkelion East', 'Kipkelion West', 'Sigowet/Soin', 'Kapsoit'] },
      { name: 'Belgut', wards: ['Belgut', 'Ainamoi', 'Kipkelion East', 'Kipkelion West', 'Sigowet/Soin', 'Kapsoit'] },
      { name: 'Kipkelion East', wards: ['Kipkelion East', 'Ainamoi', 'Belgut', 'Kipkelion West', 'Sigowet/Soin', 'Kapsoit'] },
      { name: 'Kipkelion West', wards: ['Kipkelion West', 'Ainamoi', 'Belgut', 'Kipkelion East', 'Sigowet/Soin', 'Kapsoit'] },
      { name: 'Sigowet/Soin', wards: ['Sigowet/Soin', 'Ainamoi', 'Belgut', 'Kipkelion East', 'Kipkelion West', 'Kapsoit'] },
      { name: 'Kapsoit', wards: ['Kapsoit', 'Ainamoi', 'Belgut', 'Kipkelion East', 'Kipkelion West', 'Sigowet/Soin'] }
    ]
  },
  {
    name: 'Kiambu',
    code: '22',
    constituencies: [
      { name: 'Gatundu South', wards: ['Gatundu South', 'Kiganjo', 'Ndarugu', 'Ngwereng', 'Kigoro', 'Ngewa'] },
      { name: 'Gatundu North', wards: ['Gatundu North', 'Kamwangi', 'Mucuni', 'Ndarugu', 'Gituamba', 'Nguku'] },
      { name: 'Juja', wards: ['Juja', 'Wiyumiririe', 'Kiamwangi', 'Ruriah', 'Githobokoni', 'Kalimoni'] },
      { name: 'Thika Town', wards: ['Thika Town', 'Gatundu South', 'Gatundu North', 'Juja', 'Ruiru', 'Githunguri'] },
      { name: 'Ruiru', wards: ['Ruiru', 'Gitothua', 'Kahawa Sutani', 'Kahawa Wendani', 'Mugutha', 'Githurai'] },
      { name: 'Githunguri', wards: ['Githunguri', 'Ikinu', 'Komothai', 'Ngewa', 'Kigoro', 'Githiga'] },
      { name: 'Kiambu', wards: ['Kiambu', 'Kiambaa', 'Kabete', 'Kikuyu', 'Limuru', 'Lari'] },
      { name: 'Kiambaa', wards: ['Kiambaa', 'Kiambu', 'Kabete', 'Kikuyu', 'Limuru', 'Lari'] },
      { name: 'Kabete', wards: ['Kabete', 'Kiambaa', 'Kiambu', 'Kikuyu', 'Limuru', 'Lari'] },
      { name: 'Kikuyu', wards: ['Kikuyu', 'Kabete', 'Kiambaa', 'Kiambu', 'Limuru', 'Lari'] },
      { name: 'Limuru', wards: ['Limuru', 'Kikuyu', 'Kabete', 'Kiambaa', 'Kiambu', 'Lari'] },
      { name: 'Lari', wards: ['Lari', 'Limuru', 'Kikuyu', 'Kabete', 'Kiambaa', 'Kiambu'] }
    ]
  },
  {
    name: 'Kilifi',
    code: '03',
    constituencies: [
      { name: 'Kilifi North', wards: ['Kilifi North', 'Kilifi South', 'Kaloleni', 'Rabai', 'Ganze', 'Malindi'] },
      { name: 'Kilifi South', wards: ['Kilifi South', 'Kilifi North', 'Kaloleni', 'Rabai', 'Ganze', 'Malindi'] },
      { name: 'Kaloleni', wards: ['Kaloleni', 'Kilifi North', 'Kilifi South', 'Rabai', 'Ganze', 'Malindi'] },
      { name: 'Rabai', wards: ['Rabai', 'Kilifi North', 'Kilifi South', 'Kaloleni', 'Ganze', 'Malindi'] },
      { name: 'Ganze', wards: ['Ganze', 'Kilifi North', 'Kilifi South', 'Kaloleni', 'Rabai', 'Malindi'] },
      { name: 'Malindi', wards: ['Malindi', 'Kilifi North', 'Kilifi South', 'Kaloleni', 'Rabai', 'Ganze'] },
      { name: 'Magarini', wards: ['Magarini', 'Malindi', 'Kilifi North', 'Kilifi South', 'Kaloleni', 'Rabai'] }
    ]
  },
  {
    name: 'Kirinyaga',
    code: '20',
    constituencies: [
      { name: 'Mwea', wards: ['Mwea', 'Gichugu', 'Ndia', 'Kirinyaga Central', 'Mwea', 'Gichugu'] },
      { name: 'Gichugu', wards: ['Gichugu', 'Mwea', 'Ndia', 'Kirinyaga Central', 'Gichugu', 'Mwea'] },
      { name: 'Ndia', wards: ['Ndia', 'Mwea', 'Gichugu', 'Kirinyaga Central', 'Ndia', 'Mwea'] },
      { name: 'Kirinyaga Central', wards: ['Kirinyaga Central', 'Mwea', 'Gichugu', 'Ndia', 'Kirinyaga Central', 'Mwea'] }
    ]
  },
  {
    name: 'Kisii',
    code: '45',
    constituencies: [
      { name: 'Bonchari', wards: ['Bonchari', 'South Mugirango', 'Bomachoge', 'Bobasi', 'Gucha', 'Nyaribari Masaba'] },
      { name: 'South Mugirango', wards: ['South Mugirango', 'Bonchari', 'Bomachoge', 'Bobasi', 'Gucha', 'Nyaribari Masaba'] },
      { name: 'Bomachoge Borabu', wards: ['Bomachoge Borabu', 'Bonchari', 'South Mugirango', 'Bobasi', 'Gucha', 'Nyaribari Masaba'] },
      { name: 'Bomachoge Chache', wards: ['Bomachoge Chache', 'Bonchari', 'South Mugirango', 'Bobasi', 'Gucha', 'Nyaribari Masaba'] },
      { name: 'Kitutu Chache North', wards: ['Kitutu Chache North', 'Bonchari', 'South Mugirango', 'Bomachoge', 'Bobasi', 'Gucha'] },
      { name: 'Kitutu Chache South', wards: ['Kitutu Chache South', 'Bonchari', 'South Mugirango', 'Bomachoge', 'Bobasi', 'Gucha'] },
      { name: 'Nyaribari Chache', wards: ['Nyaribari Chache', 'Bonchari', 'South Mugirango', 'Bomachoge', 'Bobasi', 'Gucha'] },
      { name: 'Nyaribari Masaba', wards: ['Nyaribari Masaba', 'Bonchari', 'South Mugirango', 'Bomachoge', 'Bobasi', 'Gucha'] }
    ]
  },
  {
    name: 'Kisumu',
    code: '42',
    constituencies: [
      { name: 'Kisumu East', wards: ['Kisumu East', 'Kisumu West', 'Kisumu Central', 'Seme', 'Nyando', 'Muhoroni'] },
      { name: 'Kisumu West', wards: ['Kisumu West', 'Kisumu East', 'Kisumu Central', 'Seme', 'Nyando', 'Muhoroni'] },
      { name: 'Kisumu Central', wards: ['Kisumu Central', 'Kisumu East', 'Kisumu West', 'Seme', 'Nyando', 'Muhoroni'] },
      { name: 'Seme', wards: ['Seme', 'Kisumu East', 'Kisumu West', 'Kisumu Central', 'Nyando', 'Muhoroni'] },
      { name: 'Nyando', wards: ['Nyando', 'Kisumu East', 'Kisumu West', 'Kisumu Central', 'Seme', 'Muhoroni'] },
      { name: 'Muhoroni', wards: ['Muhoroni', 'Kisumu East', 'Kisumu West', 'Kisumu Central', 'Seme', 'Nyando'] },
      { name: 'Nyakach', wards: ['Nyakach', 'Kisumu East', 'Kisumu West', 'Kisumu Central', 'Seme', 'Nyando'] }
    ]
  },
  {
    name: 'Kitui',
    code: '15',
    constituencies: [
      { name: 'Mwingi North', wards: ['Mwingi North', 'Mwingi Central', 'Mwingi South', 'Kitui West', 'Kitui Rural'] },
      { name: 'Mwingi Central', wards: ['Mwingi Central', 'Mwingi North', 'Mwingi South', 'Kitui West', 'Kitui Rural'] },
      { name: 'Mwingi South', wards: ['Mwingi South', 'Mwingi North', 'Mwingi Central', 'Kitui West', 'Kitui Rural'] },
      { name: 'Kitui West', wards: ['Kitui West', 'Mwingi North', 'Mwingi Central', 'Mwingi South', 'Kitui Rural'] },
      { name: 'Kitui Rural', wards: ['Kitui Rural', 'Mwingi North', 'Mwingi Central', 'Mwingi South', 'Kitui West'] },
      { name: 'Kitui Town', wards: ['Kitui Town', 'Mwingi North', 'Mwingi Central', 'Mwingi South', 'Kitui West'] },
      { name: 'Mutitu', wards: ['Mutitu', 'Mwingi North', 'Mwingi Central', 'Mwingi South', 'Kitui West'] },
      { name: 'Kitui South', wards: ['Kitui South', 'Mwingi North', 'Mwingi Central', 'Mwingi South', 'Kitui West'] }
    ]
  },
  {
    name: 'Kwale',
    code: '02',
    constituencies: [
      { name: 'Msambweni', wards: ['Msambweni', 'Lunga Lunga', 'Matuga', 'Kinango'] },
      { name: 'Lunga Lunga', wards: ['Lunga Lunga', 'Msambweni', 'Matuga', 'Kinango'] },
      { name: 'Matuga', wards: ['Matuga', 'Msambweni', 'Lunga Lunga', 'Kinango'] },
      { name: 'Kinango', wards: ['Kinango', 'Msambweni', 'Lunga Lunga', 'Matuga'] }
    ]
  },
  {
    name: 'Laikipia',
    code: '31',
    constituencies: [
      { name: 'Laikipia West', wards: ['Olmoran', 'Rumuruti Township', 'Kinamba', 'Marmanet', 'Igwamiti', 'Salama'] },
      { name: 'Laikipia East', wards: ['Ngobit', 'Tigithi', 'Thingithu', 'Nanyuki', 'Umande'] },
      { name: 'Laikipia North', wards: ['Sosian', 'Segera', 'Mukogondo East', 'Mukogondo West'] }
    ]
  },
  {
    name: 'Lamu',
    code: '05',
    constituencies: [
      { name: 'Lamu East', wards: ['Faza', 'Kiunga', 'Basuba'] },
      { name: 'Lamu West', wards: ['Shella', 'Mkomani', 'Hindi', 'Mkunumbi', 'Hongwe', 'Witu', 'Bahari'] }
    ]
  },
  {
    name: 'Machakos',
    code: '16',
    constituencies: [
      { name: 'Masinga', wards: ['Masinga Central', 'Masinga North', 'Masinga South', 'Yatta', 'Kangundo', 'Matungulu'] },
      { name: 'Yatta', wards: ['Yatta', 'Masinga Central', 'Masinga North', 'Masinga South', 'Kangundo', 'Matungulu'] },
      { name: 'Kangundo', wards: ['Kangundo Central', 'Kangundo West', 'Kangundo East', 'Matungulu', 'Kathiani', 'Mavoko'] },
      { name: 'Matungulu', wards: ['Matungulu', 'Kangundo Central', 'Kangundo West', 'Kangundo East', 'Kathiani', 'Mavoko'] },
      { name: 'Kathiani', wards: ['Kathiani', 'Matungulu', 'Kangundo Central', 'Kangundo West', 'Kangundo East', 'Mavoko'] },
      { name: 'Mavoko', wards: ['Mavoko', 'Kathiani', 'Matungulu', 'Kangundo Central', 'Kangundo West', 'Kangundo East'] },
      { name: 'Machakos Town', wards: ['Machakos Town', 'Mavoko', 'Kathiani', 'Matungulu', 'Kangundo Central', 'Kangundo West'] },
      { name: 'Mwala', wards: ['Mwala', 'Machakos Town', 'Mavoko', 'Kathiani', 'Matungulu', 'Kangundo Central'] }
    ]
  },
  {
    name: 'Makueni',
    code: '17',
    constituencies: [
      { name: 'Mbooni', wards: ['Mbooni', 'Kilome', 'Kaiti', 'Makueni', 'Kibwezi West', 'Kibwezi East'] },
      { name: 'Kilome', wards: ['Kilome', 'Mbooni', 'Kaiti', 'Makueni', 'Kibwezi West', 'Kibwezi East'] },
      { name: 'Kaiti', wards: ['Kaiti', 'Mbooni', 'Kilome', 'Makueni', 'Kibwezi West', 'Kibwezi East'] },
      { name: 'Makueni', wards: ['Makueni', 'Mbooni', 'Kilome', 'Kaiti', 'Kibwezi West', 'Kibwezi East'] },
      { name: 'Kibwezi West', wards: ['Kibwezi West', 'Mbooni', 'Kilome', 'Kaiti', 'Makueni', 'Kibwezi East'] },
      { name: 'Kibwezi East', wards: ['Kibwezi East', 'Mbooni', 'Kilome', 'Kaiti', 'Makueni', 'Kibwezi West'] }
    ]
  },
  {
    name: 'Mandera',
    code: '09',
    constituencies: [
      { name: 'Mandera West', wards: ['Mandera West', 'Banisa', 'Mandera North', 'Mandera South', 'Mandera East'] },
      { name: 'Banisa', wards: ['Banisa', 'Mandera West', 'Mandera North', 'Mandera South', 'Mandera East'] },
      { name: 'Mandera North', wards: ['Mandera North', 'Mandera West', 'Banisa', 'Mandera South', 'Mandera East'] },
      { name: 'Mandera South', wards: ['Mandera South', 'Mandera West', 'Banisa', 'Mandera North', 'Mandera East'] },
      { name: 'Mandera East', wards: ['Mandera East', 'Mandera West', 'Banisa', 'Mandera North', 'Mandera South'] },
      { name: 'Lafey', wards: ['Lafey', 'Mandera West', 'Banisa', 'Mandera North', 'Mandera South'] }
    ]
  },
  {
    name: 'Marsabit',
    code: '10',
    constituencies: [
      { name: 'Moyale', wards: ['Moyale', 'North Horr', 'Saku', 'Laisamis'] },
      { name: 'North Horr', wards: ['North Horr', 'Moyale', 'Saku', 'Laisamis'] },
      { name: 'Saku', wards: ['Saku', 'Moyale', 'North Horr', 'Laisamis'] },
      { name: 'Laisamis', wards: ['Laisamis', 'Moyale', 'North Horr', 'Saku'] }
    ]
  },
  {
    name: 'Meru',
    code: '12',
    constituencies: [
      { name: 'Igembe South', wards: ['Igembe South', 'Igembe Central', 'Igembe North', 'Tigania West', 'Tigania East'] },
      { name: 'Igembe Central', wards: ['Igembe Central', 'Igembe South', 'Igembe North', 'Tigania West', 'Tigania East'] },
      { name: 'Igembe North', wards: ['Igembe North', 'Igembe South', 'Igembe Central', 'Tigania West', 'Tigania East'] },
      { name: 'Tigania West', wards: ['Tigania West', 'Igembe South', 'Igembe Central', 'Igembe North', 'Tigania East'] },
      { name: 'Tigania East', wards: ['Tigania East', 'Igembe South', 'Igembe Central', 'Igembe North', 'Tigania West'] },
      { name: 'North Imenti', wards: ['North Imenti', 'Buuri', 'Central Imenti', 'South Imenti'] },
      { name: 'Buuri', wards: ['Buuri', 'North Imenti', 'Central Imenti', 'South Imenti'] },
      { name: 'Central Imenti', wards: ['Central Imenti', 'North Imenti', 'Buuri', 'South Imenti'] },
      { name: 'South Imenti', wards: ['South Imenti', 'North Imenti', 'Buuri', 'Central Imenti'] }
    ]
  },
  {
    name: 'Migori',
    code: '44',
    constituencies: [
      { name: 'Rongo', wards: ['Rongo', 'Awendo', 'Migori East', 'Migori West', 'Uriri', 'Nyatike'] },
      { name: 'Awendo', wards: ['Awendo', 'Rongo', 'Migori East', 'Migori West', 'Uriri', 'Nyatike'] },
      { name: 'Migori East', wards: ['Migori East', 'Rongo', 'Awendo', 'Migori West', 'Uriri', 'Nyatike'] },
      { name: 'Migori West', wards: ['Migori West', 'Rongo', 'Awendo', 'Migori East', 'Uriri', 'Nyatike'] },
      { name: 'Uriri', wards: ['Uriri', 'Rongo', 'Awendo', 'Migori East', 'Migori West', 'Nyatike'] },
      { name: 'Nyatike', wards: ['Nyatike', 'Rongo', 'Awendo', 'Migori East', 'Migori West', 'Uriri'] },
      { name: 'Kuria East', wards: ['Kuria East', 'Rongo', 'Awendo', 'Migori East', 'Migori West'] },
      { name: 'Kuria West', wards: ['Kuria West', 'Rongo', 'Awendo', 'Migori East', 'Migori West'] }
    ]
  },
  {
    name: 'Mombasa',
    code: '01',
    constituencies: [
      { name: 'Changamwe', wards: ['Changamwe', 'Jomvu', 'Kisauni', 'Nyali', 'Likoni', 'Mvita'] },
      { name: 'Jomvu', wards: ['Jomvu', 'Changamwe', 'Kisauni', 'Nyali', 'Likoni', 'Mvita'] },
      { name: 'Kisauni', wards: ['Kisauni', 'Changamwe', 'Jomvu', 'Nyali', 'Likoni', 'Mvita'] },
      { name: 'Nyali', wards: ['Nyali', 'Changamwe', 'Jomvu', 'Kisauni', 'Likoni', 'Mvita'] },
      { name: 'Likoni', wards: ['Likoni', 'Changamwe', 'Jomvu', 'Kisauni', 'Nyali', 'Mvita'] },
      { name: 'Mvita', wards: ['Mvita', 'Changamwe', 'Jomvu', 'Kisauni', 'Nyali', 'Likoni'] }
    ]
  },
  {
    name: 'Murang\'a',
    code: '21',
    constituencies: [
      { name: 'Kangema', wards: ['Kangema', 'Mathioya', 'Kiharu', 'Kigumo', 'Maragua', 'Kandara'] },
      { name: 'Mathioya', wards: ['Mathioya', 'Kangema', 'Kiharu', 'Kigumo', 'Maragua', 'Kandara'] },
      { name: 'Kiharu', wards: ['Kiharu', 'Kangema', 'Mathioya', 'Kigumo', 'Maragua', 'Kandara'] },
      { name: 'Kigumo', wards: ['Kigumo', 'Kangema', 'Mathioya', 'Kiharu', 'Maragua', 'Kandara'] },
      { name: 'Maragua', wards: ['Maragua', 'Kangema', 'Mathioya', 'Kiharu', 'Kigumo', 'Kandara'] },
      { name: 'Kandara', wards: ['Kandara', 'Kangema', 'Mathioya', 'Kiharu', 'Kigumo', 'Maragua'] },
      { name: 'Gatanga', wards: ['Gatanga', 'Kangema', 'Mathioya', 'Kiharu', 'Kigumo', 'Maragua'] }
    ]
  },
  {
    name: 'Nairobi',
    code: '47',
    constituencies: [
      { name: 'Westlands', wards: ['Parklands', 'Highridge', 'Kitisuru', 'Karura', 'Kangemi', 'Kawangware', 'Kileleshwa', 'Kabiro', 'Ngando', 'Mountain View'] },
      { name: 'Dagoretti North', wards: ['Kawangware', 'Kilimani', 'Kileleshwa', 'Kabiro', 'Ngando', 'Mountain View', 'Uthiru', 'Ruthimitu', 'Kawangware', 'Kilimani'] },
      { name: 'Dagoretti South', wards: ['Kawangware', 'Kilimani', 'Kileleshwa', 'Kabiro', 'Ngando', 'Mountain View', 'Uthiru', 'Ruthimitu', 'Kawangware', 'Kilimani'] },
      { name: 'Langata', wards: ['Karen', 'Langata', 'Nairobi West', 'South C', 'South B', 'Karen', 'Langata', 'Nairobi West', 'South C', 'South B'] },
      { name: 'Kibra', wards: ['Kibra', 'Laini Saba', 'Sarangombe', 'Kibra', 'Laini Saba', 'Sarangombe', 'Kibra', 'Laini Saba', 'Sarangombe', 'Kibra'] },
      { name: 'Roysambu', wards: ['Kasarani', 'Mihang\'o', 'Githurai', 'Kahawa West', 'Mwiki', 'Roysambu', 'Kasarani', 'Mihang\'o', 'Githurai', 'Kahawa West'] },
      { name: 'Kasarani', wards: ['Kasarani', 'Mihang\'o', 'Githurai', 'Kahawa West', 'Mwiki', 'Kasarani', 'Mihang\'o', 'Githurai', 'Kahawa West', 'Mwiki'] },
      { name: 'Ruaraka', wards: ['Ruaraka', 'Kasarani', 'Mihang\'o', 'Githurai', 'Kahawa West', 'Mwiki', 'Ruaraka', 'Kasarani', 'Mihang\'o', 'Githurai'] },
      { name: 'Embakasi South', wards: ['Mukuru Kwa Njenga', 'Mukuru Kwa Ruben', 'Kariobangi South', 'South C', 'Imara Daima', 'Mukuru Kwa Njenga', 'Mukuru Kwa Ruben', 'Kariobangi South', 'South C', 'Imara Daima'] },
      { name: 'Embakasi Central', wards: ['Kayole', 'Komarock', 'Kwash', 'Matopeni', 'Kayole Central', 'Kayole South', 'Kayole', 'Komarock', 'Kwash', 'Matopeni'] },
      { name: 'Embakasi North', wards: ['Dandora', 'Kayole', 'Komarock', 'Kwash', 'Matopeni', 'Kayole Central', 'Kayole South', 'Dandora', 'Kayole', 'Komarock'] },
      { name: 'Embakasi East', wards: ['Dandora', 'Kayole', 'Komarock', 'Kwash', 'Matopeni', 'Kayole Central', 'Kayole South', 'Dandora', 'Kayole', 'Komarock'] },
      { name: 'Embakasi West', wards: ['Utawala', 'Njiru', 'Kahawa Soweto', 'Kahawa Wendani', 'Clay City', 'Komarock', 'Kwash', 'Matopeni', 'Utawala', 'Njiru'] },
      { name: 'Makadara', wards: ['Makadara', 'Nyayo Highrise', 'Jericho', 'Mukuru', 'Viwandani', 'Makadara', 'Nyayo Highrise', 'Jericho', 'Mukuru', 'Viwandani'] },
      { name: 'Kamukunji', wards: ['Pumwani', 'Majengo', 'Huruma', 'Eastlands', 'California', 'Ziwani', 'Makadara', 'Maringo', 'Mukuru', 'Pumwani'] },
      { name: 'Starehe', wards: ['Starehe', 'Mathare', 'Huruma', 'Eastlands', 'California', 'Ziwani', 'Makadara', 'Maringo', 'Mukuru', 'Starehe'] },
      { name: 'Mathare', wards: ['Mathare', 'Huruma', 'Eastlands', 'California', 'Ziwani', 'Mathare', 'Huruma', 'Eastlands', 'California', 'Ziwani'] }
    ]
  },
  {
    name: 'Nakuru',
    code: '32',
    constituencies: [
      { name: 'Molo', wards: ['Molo', 'Elburgon', 'Mugugu', 'Turi', 'Subukia', 'Kiamunyi'] },
      { name: 'Njoro', wards: ['Njoro', 'Ndaragwa', 'Bahati', 'Strathmore', 'Nessuit', 'Mukango'] },
      { name: 'Naivasha', wards: ['Naivasha', 'Karati', 'Longonot', 'Mai Mahiu', 'Maella', 'Gilgil'] },
      { name: 'Gilgil', wards: ['Gilgil', 'Naivasha', 'Karati', 'Longonot', 'Mai Mahiu', 'Ewalel'] },
      { name: 'Kuresoi North', wards: ['Kuresoi', 'Sururu', 'Tinet', 'Kabartonjo', 'Mogotio', 'Lembus'] },
      { name: 'Kuresoi South', wards: ['Kuresoi South', 'Mukiamwia', 'Kedowoso', 'Amalo', 'Tumoi', 'Kipkuresoi'] },
      { name: 'Rongai', wards: ['Rongai', 'Menengai West', 'Menengai East', 'Mukango', 'Bahati', 'Larmudiac'] },
      { name: 'Subukia', wards: ['Subukia', 'Bahati', 'Ndaragwa', 'Mukango', 'Larmudiac', 'Kiamunyi'] },
      { name: 'Bahati', wards: ['Bahati', 'Subukia', 'Rongai', 'Menengai West', 'Menengai East', 'Mukango'] }
    ]
  },
  {
    name: 'Nandi',
    code: '29',
    constituencies: [
      { name: 'Aldai', wards: ['Kipkaren', 'Koisaram', 'Tindinyo', 'Chemelil', 'Kapsabet Town', 'Ainamoi'] },
      { name: 'Chesumei', wards: ['Chesumei', 'Moiben', 'Emgwen', 'Kapsaraban', 'Kipkaren', 'Tindinyo'] },
      { name: 'Emgwen', wards: ['Emgwen', 'Chesumei', 'Moiben', 'Kapsaraban', 'Kipkaren', 'Tindinyo'] },
      { name: 'Mosop', wards: ['Mosop', 'Nandi Hills', 'Kipkaren', 'Tindinyo', 'Chemelil', 'Kapsabet Town'] },
      { name: 'Nandi Hills', wards: ['Nandi Hills', 'Mosop', 'Kipkaren', 'Tindinyo', 'Chemelil', 'Kapsabet Town'] },
      { name: 'Tinderet', wards: ['Tinderet', 'Nandi Hills', 'Ainamoi', 'Kapsabet Town', 'Chemelil', 'Kipkaren'] }
    ]
  },
  {
    name: 'Narok',
    code: '33',
    constituencies: [
      { name: 'Narok North', wards: ['Narok North', 'Narok South', 'Narok East', 'Narok West'] },
      { name: 'Narok South', wards: ['Narok South', 'Narok North', 'Narok East', 'Narok West'] },
      { name: 'Narok East', wards: ['Narok East', 'Narok North', 'Narok South', 'Narok West'] },
      { name: 'Narok West', wards: ['Narok West', 'Narok North', 'Narok South', 'Narok East'] }
    ]
  },
  {
    name: 'Nyamira',
    code: '46',
    constituencies: [
      { name: 'North Mugirango', wards: ['North Mugirango', 'West Mugirango', 'Kitutu Masaba', 'Borabu'] },
      { name: 'West Mugirango', wards: ['West Mugirango', 'North Mugirango', 'Kitutu Masaba', 'Borabu'] },
      { name: 'Kitutu Masaba', wards: ['Kitutu Masaba', 'North Mugirango', 'West Mugirango', 'Borabu'] },
      { name: 'Borabu', wards: ['Borabu', 'North Mugirango', 'West Mugirango', 'Kitutu Masaba'] }
    ]
  },
  {
    name: 'Nyandarua',
    code: '18',
    constituencies: [
      { name: 'Ol Kalou', wards: ['Ol Kalou', 'Ol Joro Orok', 'Gilgil', 'Njoro', 'Molo', 'Subukia'] },
      { name: 'Ol Joro Orok', wards: ['Ol Joro Orok', 'Ol Kalou', 'Gilgil', 'Njoro', 'Molo', 'Subukia'] },
      { name: 'Gilgil', wards: ['Gilgil', 'Ol Kalou', 'Ol Joro Orok', 'Njoro', 'Molo', 'Subukia'] },
      { name: 'Njoro', wards: ['Njoro', 'Ol Kalou', 'Ol Joro Orok', 'Gilgil', 'Molo', 'Subukia'] },
      { name: 'Molo', wards: ['Molo', 'Ol Kalou', 'Ol Joro Orok', 'Gilgil', 'Njoro', 'Subukia'] }
    ]
  },
  {
    name: 'Nyeri',
    code: '19',
    constituencies: [
      { name: 'Tetu', wards: ['Tetu', 'Kieni', 'Othaya', 'Mukurweini', 'Mathira', 'Nyeri Town'] },
      { name: 'Kieni', wards: ['Kieni', 'Tetu', 'Othaya', 'Mukurweini', 'Mathira', 'Nyeri Town'] },
      { name: 'Othaya', wards: ['Othaya', 'Tetu', 'Kieni', 'Mukurweini', 'Mathira', 'Nyeri Town'] },
      { name: 'Mukurweini', wards: ['Mukurweini', 'Tetu', 'Kieni', 'Othaya', 'Mathira', 'Nyeri Town'] },
      { name: 'Mathira', wards: ['Mathira', 'Tetu', 'Kieni', 'Othaya', 'Mukurweini', 'Nyeri Town'] },
      { name: 'Nyeri Town', wards: ['Nyeri Town', 'Tetu', 'Kieni', 'Othaya', 'Mukurweini', 'Mathira'] }
    ]
  },
  {
    name: 'Samburu',
    code: '25',
    constituencies: [
      { name: 'Samburu East', wards: ['Samburu East', 'Samburu North', 'Samburu West'] },
      { name: 'Samburu North', wards: ['Samburu North', 'Samburu East', 'Samburu West'] },
      { name: 'Samburu West', wards: ['Samburu West', 'Samburu East', 'Samburu North'] }
    ]
  },
  {
    name: 'Siaya',
    code: '41',
    constituencies: [
      { name: 'Alego Usonga', wards: ['Alego Usonga', 'Ugenya', 'Ukwala', 'Gem', 'Bondo', 'Rarieda'] },
      { name: 'Ugenya', wards: ['Ugenya', 'Alego Usonga', 'Ukwala', 'Gem', 'Bondo', 'Rarieda'] },
      { name: 'Ukwala', wards: ['Ukwala', 'Alego Usonga', 'Ugenya', 'Gem', 'Bondo', 'Rarieda'] },
      { name: 'Gem', wards: ['Gem', 'Alego Usonga', 'Ugenya', 'Ukwala', 'Bondo', 'Rarieda'] },
      { name: 'Bondo', wards: ['Bondo', 'Alego Usonga', 'Ugenya', 'Ukwala', 'Gem', 'Rarieda'] },
      { name: 'Rarieda', wards: ['Rarieda', 'Alego Usonga', 'Ugenya', 'Ukwala', 'Gem', 'Bondo'] }
    ]
  },
  {
    name: 'Taita-Taveta',
    code: '06',
    constituencies: [
      { name: 'Mwatate', wards: ['Mwatate', 'Voi', 'Taveta', 'Wundanyi'] },
      { name: 'Voi', wards: ['Voi', 'Mwatate', 'Taveta', 'Wundanyi'] },
      { name: 'Taveta', wards: ['Taveta', 'Mwatate', 'Voi', 'Wundanyi'] },
      { name: 'Wundanyi', wards: ['Wundanyi', 'Mwatate', 'Voi', 'Taveta'] }
    ]
  },
  {
    name: 'Tana River',
    code: '04',
    constituencies: [
      { name: 'Garsen', wards: ['Garsen', 'Bura', 'Galole'] },
      { name: 'Bura', wards: ['Bura', 'Garsen', 'Galole'] },
      { name: 'Galole', wards: ['Galole', 'Garsen', 'Bura'] }
    ]
  },
  {
    name: 'Tharaka-Nithi',
    code: '13',
    constituencies: [
      { name: 'Chuka/Igambang\'ombe', wards: ['Chuka/Igambang\'ombe', 'Tharaka', 'Maara'] },
      { name: 'Tharaka', wards: ['Tharaka', 'Chuka/Igambang\'ombe', 'Maara'] },
      { name: 'Maara', wards: ['Maara', 'Chuka/Igambang\'ombe', 'Tharaka'] }
    ]
  },
  {
    name: 'Trans Nzoia',
    code: '26',
    constituencies: [
      { name: 'Endebess', wards: ['Endebess', 'Cherang\'any', 'Kwanza', 'Saboti', 'Kimilili', 'Kiminini'] },
      { name: 'Cherang\'any', wards: ['Cherang\'any', 'Endebess', 'Kwanza', 'Saboti', 'Kimilili', 'Kiminini'] },
      { name: 'Kwanza', wards: ['Kwanza', 'Endebess', 'Cherang\'any', 'Saboti', 'Kimilili', 'Kiminini'] },
      { name: 'Saboti', wards: ['Saboti', 'Endebess', 'Cherang\'any', 'Kwanza', 'Kimilili', 'Kiminini'] },
      { name: 'Kiminini', wards: ['Kiminini', 'Endebess', 'Cherang\'any', 'Kwanza', 'Saboti', 'Kimilili'] }
    ]
  },
  {
    name: 'Turkana',
    code: '23',
    constituencies: [
      { name: 'Turkana Central', wards: ['Turkana Central', 'Loima', 'Turkana East', 'Turkana North', 'Turkana South', 'Turkana West'] },
      { name: 'Loima', wards: ['Loima', 'Turkana Central', 'Turkana East', 'Turkana North', 'Turkana South', 'Turkana West'] },
      { name: 'Turkana East', wards: ['Turkana East', 'Turkana Central', 'Loima', 'Turkana North', 'Turkana South', 'Turkana West'] },
      { name: 'Turkana North', wards: ['Turkana North', 'Turkana Central', 'Loima', 'Turkana East', 'Turkana South', 'Turkana West'] },
      { name: 'Turkana South', wards: ['Turkana South', 'Turkana Central', 'Loima', 'Turkana East', 'Turkana North', 'Turkana West'] },
      { name: 'Turkana West', wards: ['Turkana West', 'Turkana Central', 'Loima', 'Turkana East', 'Turkana North', 'Turkana South'] }
    ]
  },
  {
    name: 'Uasin Gishu',
    code: '27',
    constituencies: [
      { name: 'Turbo', wards: ['Turbo', 'Kesses', 'Ainamoi', 'Soy', 'Kipkaren', 'Moiben'] },
      { name: 'Kesses', wards: ['Kesses', 'Turbo', 'Ainamoi', 'Soy', 'Kipkaren', 'Moiben'] },
      { name: 'Ainamoi', wards: ['Ainamoi', 'Turbo', 'Kesses', 'Soy', 'Kipkaren', 'Moiben'] },
      { name: 'Soy', wards: ['Soy', 'Turbo', 'Kesses', 'Ainamoi', 'Kipkaren', 'Moiben'] },
      { name: 'Kipkaren', wards: ['Kipkaren', 'Turbo', 'Kesses', 'Ainamoi', 'Soy', 'Moiben'] },
      { name: 'Moiben', wards: ['Moiben', 'Turbo', 'Kesses', 'Ainamoi', 'Soy', 'Kipkaren'] }
    ]
  },
  {
    name: 'Vihiga',
    code: '38',
    constituencies: [
      { name: 'Vihiga', wards: ['Vihiga', 'Sabatia', 'Hamisi', 'Emuhaya', 'Luanda'] },
      { name: 'Sabatia', wards: ['Sabatia', 'Vihiga', 'Hamisi', 'Emuhaya', 'Luanda'] },
      { name: 'Hamisi', wards: ['Hamisi', 'Vihiga', 'Sabatia', 'Emuhaya', 'Luanda'] },
      { name: 'Emuhaya', wards: ['Emuhaya', 'Vihiga', 'Sabatia', 'Hamisi', 'Luanda'] },
      { name: 'Luanda', wards: ['Luanda', 'Vihiga', 'Sabatia', 'Hamisi', 'Emuhaya'] }
    ]
  },
  {
    name: 'Wajir',
    code: '08',
    constituencies: [
      { name: 'Wajir East', wards: ['Wajir East', 'Wajir West', 'Wajir South', 'Wajir North'] },
      { name: 'Wajir West', wards: ['Wajir West', 'Wajir East', 'Wajir South', 'Wajir North'] },
      { name: 'Wajir South', wards: ['Wajir South', 'Wajir East', 'Wajir West', 'Wajir North'] },
      { name: 'Wajir North', wards: ['Wajir North', 'Wajir East', 'Wajir West', 'Wajir South'] }
    ]
  },
  {
    name: 'West Pokot',
    code: '24',
    constituencies: [
      { name: 'West Pokot', wards: ['West Pokot', 'Pokot South', 'Kacheliba', 'Sigid', 'Alale'] },
      { name: 'Pokot South', wards: ['Pokot South', 'West Pokot', 'Kacheliba', 'Sigid', 'Alale'] },
      { name: 'Kacheliba', wards: ['Kacheliba', 'West Pokot', 'Pokot South', 'Sigid', 'Alale'] },
      { name: 'Sigid', wards: ['Sigid', 'West Pokot', 'Pokot South', 'Kacheliba', 'Alale'] },
      { name: 'Alale', wards: ['Alale', 'West Pokot', 'Pokot South', 'Kacheliba', 'Sigid'] }
    ]
  },
  {
    
  }
];

export default counties;