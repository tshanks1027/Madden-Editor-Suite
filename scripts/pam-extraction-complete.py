"""
Complete PAM extraction from all screenshots viewed in this session
Compiles batch 1 (from compile-pam-list.py) + new batches from screenshots 102541-110210
"""

# Batch 1: Already extracted (247 names from screenshots 101237-102433)
pam_batch1 = [
    # From compile-pam-list.py
    "abanikandaIsrael_22741", "abdullahAmeer_2402", "abramJohnathan_20459", "achaneDevon_22692",
    "adamsDavante_10823", "adamsJamal_12524", "addaeJahleel_9919", "adderleyNasir_20455",
    "addisonJordan_22693", "addisonMario_10984", "adebopaulson_21445", "agholorNelson_2442",
    "aguayoRoberto_17695", "AjyukBrandon_21069", "ajayjay_2400",
    "akersCam_20919", "alexanderjaire_13109", "alexanderLorenzo_28291", "alexanderMackensie_17553",
    "alexanderMaurice_2101", "allegrettiNick_20724", "allenBrandon_17606", "allenBrian_13223",
    "allendwayne_11281", "allenjavonus_2408", "allenJonathan_12521", "allenJosh_13197",
    "AllenJosh_20410", "allenKeenan_505", "allenLarry_12223", "AllocierTyler_22315",
    "alShaairAzeez_20688", "alstottMike_12232", "AltJoe_14694", "amersondavid_11893",
    "andersonDerek_26674", "andersonJrWill_22702", "andersonRobby_17960", "andrewsmark_13112",
    "AngerBryan_11594", "ansahezekiel_1121", "antetokounmpoGiannis_2995", "antetokounmpoKostas_2997",
    "antetokounmpothanasis_2996", "anzaloneAlex_12613", "appleEli_17653", "arcegaWhitesideJJ_20344",
    "armsteadArik_2533", "armsteadTerron_964", "ArroyoElijah_15119", "artispaynecameron_2412",
    "asamoahIIBrian_22190", "atkinsGeno_9867", "austiniiicalvin_22086", "austinTavon_494",
    "avrilCliff_28460", "awuzieChidobe_12587", "ayersDeMarcus_17865", "bagentTyson_22900",
    "baileychamp_1523", "baileyDan_10933", "baileyJake_20480",
    "bakerBudda_12549", "bakhtiariDavid_1713", "baldwindoug_11029", "BanksJrKelvin_15161",
    "barberPeyton_17612", "baringerbryce_23112", "barkleymatt_116", "BarkleySaquon_13085",
    "barmoreChristian_21765", "barnettderek_12530", "barranthony_10828", "barronjahdae_15277",
    "bartonCody_20692", "barwinConnor_20153", "BatesIIJessie_13202", "baughSammy",
    "beasleyCole_11791",
    "beathardCJ_12652", "beckhamJrOdell_10829", "bectonMekhi_20969", "bellLeVeon_344",
    "BelloreNick_10939", "bellVonn_17654", "benjaminkelvin_10830", "benjamintravis_11454",
    "bensonTrey_14622", "bentonKeeanu_22934", "benwikerebene_2090", "bernardGiovani_323",
    "berryEric_9950", "bersinBrenton_2271", "betheaantoine_27338", "BettisJerome_1655",
    "blackmonJulian_21269",
    "blandageorge", "BlandDaron_22485", "blankenshipRodrigo_21168", "blantonRobert_11682",
    "boldenBrandon_11244", "boldinanquan", "boltonNick_21474", "bookerDevontae_17575",
    "bookerTyler_15162", "boothjrAndrew_22255", "bortlesBlake_10834", "bosaJoey_17537",
    "bosaNick_20565", "bosherMatt_10806", "bosticjon_1331", "bostonTre_2089",
    "boswellChris_2262",
    "boulwareben_12695", "bouyeAJ_14134", "bowersBrock_14678", "bowmannavorro_9886",
    "boydTyler_17593", "bradberryJames_17825", "bradfordcarl_2083", "bradfordsam_9710",
    "bradyTom_1327", "BranchBrian_23024", "breesDrew_14118", "bridgewaterTeddy_10837",
    "briskerjaquan_22228", "brissettjacoby_17566", "BrittJustin_2122", "brittKenny_20057",
    "brockersMichael_11298",
    "brooksahmad_27818", "brooksderrick_11202", "brownaj_20495", "brownantonio_9774",
    "brownCorey_2292", "BrownDerrick_21286", "brownDuane_28431", "browningJake_20329",
    "brownMarlon_14057", "brownMarquise_20497", "brownOrlando_13083", "brownphilly_2292",
    "brownzach_11307", "BryantCoby_22211", "bryantdesmond_28823", "bryantdez_9754",
    "bryantmartavis_10840",
    "bryantmatt_15694", "bucannonDeone_10841", "bucknerDeForest_17542", "bullockRandy_11601",
    "BurdenIIILuther_15095", "burfictvontaze_11569", "burkheadrex_11945", "burksTreylon_22069",
    "burnettmorgan_9954", "burnsArtie_17657", "burnsBrian_20566", "BurrowJoe_20948",
    "bushDevin_20583", "bushrodjermon_28039", "butkerHarrison_12863", "butlerHakeem_20499",
    "buttJake_12568",
    "byrdjairus_20147", "campbellCalais_28363", "campbellearl", "CampbellJihaad_15268",
    "campbellParris_20355", "CampbellTyson_21696", "CampbellWill_15160", "cannAJ_2506",
    "carrBrandon_28491", "carrDerek_10843", "CarterAbdul_15198", "carterjalen_22703",
    "carterMichael_21568", "cashmanBlake_20693", "casselMatt_27037", "celebkrent_28108",
    "cephusQuintez_20946", "chaissonKLavon_20991", "chancellorkam_9964", "CharbonnetZach_22732",
    "charkDJ_13255", "charlesJamaal_28343", "charltonTaco_12535", "chaseJaMarr_21586",
    "chenalleo_22458", "chinnJeremy_21151", "chubbBradley_13079", "chubbNick_13129",
    "chungPatrick_20146", "churchbarry_9969", "cineLewis_22397", "cladyryan_28406",
    "ClarkKenny_17661",
    "claypoolchase_21077", "clementCorey_12653", "clintondixhaha_10844", "clowneyJadeveon_10845",
    "cobbRandall_10619", "cohenTarik_12786", "coleiiaj_20821", "colemanBobby_197",
    "colemanCorey_17556", "ColemanKeon_14646", "colemanTevin_2401", "collinsAlex_17576",
    "collinsJamie_1285", "collinsLael_2499", "collinsMaliek_17738", "collinsNico_21587",
    "collinsSrJamie_1285",
    "CollinsZaven_21495", "colquittBritton_29169", "colquittDustin_26820", "comptonWill_2336",
    "conleyGareon_12565", "connerJames_12664", "cookconnor_17560", "cookDalvin_12523",
    "cookJames_22054", "cookJared_20090", "cooksBrandin_10847", "cooperamari_2435",
    "cooperPharoh_17595", "corralmatt_22045", "CosmiSam_21533", "cousinsKirk_11215",
    "covingtonChris_13451",
    "crabtreemichael_20056", "cravenssua_17664", "crawfordTyrone_11519", "crawleyKen_12429",
    "crosbymason_27996", "crosbyMaxx_20571", "crosscharles_22437", "crowderJamison_2450",
    "cunninghamZach_12581", "curlKamren_21012", "cyprienjohnathan_1472", "daltonAndy_10439",
    "DanielsJayden_14579", "dareusmarcell_10718", "darkwaOrleans_2316", "darnoldsam_13097",
]

# Batch 2: Screenshots 102541-104059
pam_batch2 = [
    # Screenshot 102541
    "darnoldsam_13097", "davenportOmega_21568", "davisademlee_28424", "daviscorey_28424",
    "davisDemarcus_20056", "davisjoshua_17567", "davisMike_10852", "davisStefon_13064",
    "davisTariq_15137", "davisTre_2510", "davisTrevor_14059", "dawkinsBrian_17583",
    "dawsonDuke_21170", "dayTaylion_14661",

    # Screenshot 102557
    "deatrichWeston_2112", "deckerEric_10853", "delaireTrevor_22083", "delhommejake_28311",
    "delleMerrick_13099", "dennisonNeil_1632", "denseNoah_17737", "deotereon_2397",
    "devilbisstrea_11224", "dewaldjamille_2519", "dewittDoug_11890", "dialKelontae_20584",
    "dickersonjermaine_28351", "dicksonmichael_13214", "diggsStefon_17543", "diggsTrevon_20970",

    # Screenshot 102621
    "dillardtim_27939", "dillonAJ_21079", "dixonbishop", "dobbsjk_13128", "dockerymarcus_1338",
    "dodsonquiton_22482", "donnellChris_28461", "dorseypewitt_22069", "dorseyKen_2420",
    "doubleronnie_11251", "doucetwilliam_27963", "douglasdemarious_13141", "douglasrasul_12567",
    "dowdleRico_22256",

    # Screenshot 102634
    "dowdlejoshua_20585", "doyedarian_22049", "draftsam_13082", "dragonette_2395",
    "drakelonnie_28301", "driscollSteve_21278", "droppeduke_1637", "dudamearcus_20098",
    "dudleyjared_11893", "dukeThomas_20149", "dunbarvontae_2500", "duncanFranklin_12536",
    "dungyTony_28436", "dunlapCarlos_20157",

    # Screenshot 102709
    "dunnlael_11251", "dunnronnie_11299", "dupreemalachi_2449", "durhamDe_9753",
    "duvaldarius_22046", "eakeledan_1637", "earlyjack_2086", "easleykenney_1346",
    "eastondemarco_27922", "ebroneric_10856", "ebukamebuka_13142", "eckeleraustin_12598",
    "edebalisemmanuel_1716", "edelman_11303", "edelman_11303",

    # Screenshot 102752
    "edgegerrin_28448", "edmondsChase_20586", "edwardsanthony_2403", "edwardsbernard_13216",
    "edwardsbrian_27956", "edwardsDavid_20686", "edwardsglenn_27956", "edwardsStan_10814",
    "ekejiobuelijah_20972", "ekeleriehisenior_20972", "ekkubanchris_22055", "elamAbram_12664",
    "eldondonald_2285", "elfleinevan_2087", "elliottEzekiel_17544",

    # Screenshot 102804
    "elliottJeremiah_28451", "ellisonMike_10858", "elumenormatthieu_15198", "elusorsammy_1718",
    "emoryKJ_22914", "engeljosh_13224", "englijakevan_22740", "englijakevan_22740",
    "enunwamike_20498", "enuwajiimmanuel_1290", "ertzZach_10859", "escobarNelson_17658",
    "espensachede_21159", "etienetravis_2408",

    # Screenshot 102818
    "evansevans_10860", "evansGavon_21532", "evansjosh_20087", "evansJustin_13143",
    "evansmike_10860", "evansrashaan_11288", "ezeukakelechi_28295", "fairbairndaniel_20158",
    "fajardoalbert_28321", "falconarthur_13195", "falelepenei_11558", "falkLuke_20332",
    "farleyCaleb_21498", "FarmeronAmeer_11308",

    # Screenshot 102851
    "farveMichael_28478", "farveBrett_1330", "fauremervin_28478", "fejedelemsam_17568",
    "felicianoWill_13364", "fergusonreid_20971", "fernslerbernie_11298", "ferreRaimann_22382",
    "fettybrian_27969", "fiedorowiczCJ_1453", "fieldsale_21162", "fieldsJustin_21565",
    "figuersilysesney_1453", "fischerjakob_22087",

    # Screenshot 102906
    "fisk_2282", "fiskjulian_28388", "fitspatrickryan_21571", "fitzgeraldlarry_11243",
    "fitzmagicroyan_28363", "fitzpatrickryann_21571", "fitzpatricktravis_17545",
    "fletcherlondon_22705", "florenChris_21007", "florescortes_11233", "flowerstreudavenport_20160",
    "flynnCT_13361", "folesjake_20977", "folksmak_27923",

    # Screenshot 102920
    "foornathaniel_20150", "forbesvemon_22314", "fordinicole_17577", "fordemaric_21164",
    "fordebernardo_17577", "fordemmett_11562", "foremanarmani_22060", "formanlyle_22060",
    "forsterlucy_27963", "forsettjustin_28457", "forsythecairo_22310", "fortduvernay_2511",
    "forteLonnie_11249", "fortunydalton_21165",

    # Screenshot 102937
    "fosterdiandre_22059", "fosterMason_20159", "fosterramon_11247", "fosterkirkpatrick_22059",
    "fournetteLeonard_12548", "fowleralvin_20697", "foxonbenmarcus_28345", "foxsamuel_1291",
    "foydunion_21506", "franchiseammon_20095", "franceschihomer_11598", "franklinkirkpatric_17592",
    "franklukedan_20995", "franyuelo_20334",

    # Screenshot 103023
    "freemandevonta_17546", "freemanroyce_17546", "freemanroyce_2436", "freemandroyce_2436",
    "freeneylyle_11282", "frenchquaylon_21163", "freiermuthPat_21570", "fullercorey_13144",
    "fullercorey_2298", "fullerKyle_11251", "fullerKyle_22056", "fullerWill_13181",
    "fullwood_20097", "furgusonblake_20974",

    # Screenshot 103047
    "furlongtyler_20976", "gabrieljc_20977", "gainesde_2314", "galapoleyan_12606",
    "gallarddaylen_17747", "gallmanwayne_12540", "galoppoaj_20498", "galoppoalfredo_20498",
    "galtsomerome_11291", "gamblemike_22061", "gannondave_28298", "garcianilklaas_17824",
    "gardenerminshewll_20586", "gardnerbilly_28375",

    # Screenshot 103059
    "garretmyles_12547", "garretthenry_22062", "garrinbrandon_17553", "garroppolojimmy_11577",
    "garverrasmussen_20943", "gaskinmyles_20588", "gatesDavid_2315", "gatewoodsidrian_20498",
    "gayWilam_17867", "gayWilliams_17867", "gbinije_1644", "geersmichael_20696",
    "gentrylynae_2317", "georgejohnathan_22063",

    # Screenshot 103121
    "gerswilkekyle_17619", "gibsonanton_13160", "gibsonlucas_13160", "gibsonrisley_2504",
    "gibsonVaughn_21508", "gielachris_28383", "gilbertGarrett_20092", "gilbertjustinraj_13081",
    "gillanmichael_17578", "gillespieduke_28471", "gilliamjayden_22468", "gillispiemarco_12542",
    "gilmoreStephon_11253", "gilmorestephontuitt_11253",

    # Screenshot 103144
    "gladneyCameron_20978", "glassgowgraham_2395", "glennstanton_10820", "goboummerci_20337",
    "godchaux_12620", "godfreymile_15096", "godwinchris_12657", "goffJared_17547",
    "goldenMarquise_17598", "goldsonrashaan_28304", "golladayKenny_12543", "gomezjordan_20094",
    "gonzalezjorge_22464", "gonzaleszane_22064",

    # Screenshot 103200
    "goodell_2278", "goodsonMike_13131", "goodsontj_22467", "goodwinjustin_20697",
    "goodwinmarquise_17598", "goodwynjeff_11563", "gooffard_17547", "gordonanthony_2518",
    "gordonDee_21172", "gordonjosh_11257", "gordonmelvin_10820", "gordonmelvinlll_10820",
    "gosderjerrynt_20698", "gosederjerry_13218",

    # Screenshot 103226
    "gottfriedjake_20333", "gouldrobbie_27940", "gowdykevin_20096", "gradybradley_12701",
    "gradkowskibruce_28358", "grahamcorey_13104", "grantryans_2460", "grantcordaralle_11258",
    "granthalfonzo_28327", "grantjakeem_17582", "gravesfoley_22072", "graycam_2404",

    # Screenshot 103240
    "graydarien_20703", "grayjason_28399", "graywilam_22072", "grazenthomas_21507",
    "greenbenjamin_17548", "green_10865", "greenAJ_12552", "greenbashaud_27917",
    "greendarius_12542", "greenejames_2522", "greenejoe_11562", "greenlaw_20699",
    "greennicole_22073", "greentrent_10865",

    # Screenshot 103311
    "gregorychad_1637", "gregoryreedley_20702", "griersyil_20337", "griffeyken_28396",
    "griffinjames_20333", "griffinquentin_20335", "griffinryan_13104", "griffinshaquem_13145",
    "griffinshaquille_17549", "griggyjason_22065", "grimesquincy_20989", "grissomgeronimo_22465",
    "gronkRob_11260", "grossanxan_2398",

    # Screenshot 103316
    "gen_2_B_N_0013", "gen_2_B_N_0014", "gen_2_B_N_0015", "gen_2_B_N_0016",
    "gen_2_B_N_0017", "gen_2_B_N_0018", "gen_2_B_N_006", "gen_2_B_N_007",
    "gen_2_b_n_008", "gen_2_B_N_009", "gen_2_B_N_01", "gen_2_B_N_02",
    "gen_2_B_N_03", "gen_2_B_S_001", "gen_2_B_S_005", "gen_2_B_S_006",
    "gen_2_B_S_007",

    # Screenshot 103332
    "grossmankyle_20348", "grovesquenton_22066", "grugierCam_21510", "guicesderrius_13106",
    "gunnerkalen_22470", "gurlexTodd_11262", "gutekunstaustin_17553", "guyTavon_12544",
    "haackkyle_21166", "hackenbergchristian_17557", "hackettNathaniel_15280", "haddenWillam_2109",

    # Screenshot 103347
    "hadleyDavid_22067", "haganjoel_21169", "haircalvin_17874", "hakkertyrone_17830",
    "halibutikhalil_20979", "hallfloyd_28428", "halljoe_2320", "hallkyle_22075",
    "hallmarcos_1461", "halotevarez_28317", "hamiltondarell_12554", "hamiltonduke_20336",
    "hamiltonkevin_11566", "hamiltontrent_21494",

    # Screenshot 103405
    "hamlerKJ_20992", "hammerjason_22068", "hammondthaddeus_28364", "handronnie_20699",
    "hankinstravis_13095", "hannahCole_22076", "hansenJC_17650", "hardenwilken_17593",
    "hardenthaddeus_28364", "hardinsonlacarcus_20338", "hardmanmechole_20591", "hardykevin_17687",
    "hargreavejustin_21571", "hargroverharris_21571",

    # Screenshot 103419
    "harisoncj_21176", "harrisbobby_11891", "harrisch_13146", "harrischris_13146",
    "harrischristopher_13146", "harrisdamien_20063", "harrisdamontae_20698", "harrisdeonte_12665",
    "harrisjcj_13146", "harriskekwane_22315", "harrisnajee_21573", "harristj_11567",
    "harristrestan_12603", "harrisuraye_2296",

    # Screenshot 103440
    "harrisonjames_20349", "harrisonjonnu_17579", "harrisonronnie_11567", "harrisronjr_11567",
    "harrisrodney_11567", "harteraven_22317", "hartmananthony_2318", "hartquentin_21177",
    "hartstevejody_28380", "harvinjacob_13182", "haskellNoel_2083", "haskinsdwayne_20338",
    "hasselbektreed_2340", "hastingsWill_20980",

    # Screenshot 103458
    "hatcherkyle_22069", "havensteinmike_2447", "hawestyree_1637", "hawkinscorey_21499",
    "haydenkelvin_12599", "hayesMichael_17735", "haynesgabriel_22477", "haywardCasey_13067",
    "haywardconnor_20339", "heathchris_28436", "heathjeff_27921", "heavenaustin_11264",
    "hedleycovey_13069", "heflinmaliek_21174",

    # Screenshot 103513
    "heidariHodges_20596", "heimstephen_20700", "heinickeTaylor_13183", "heinzchris_13183",
    "hejsmanuel_22479", "hellurenthony_13069", "helsleyquandre_28435", "hemingjohnathan_17743",
    "hendersonjustinl_20698", "hendricksevan_13184", "henleyjonjc_22478", "henneman_17659",
    "hennequinwill_21487", "henreyderrick_13196",

    # Screenshot 103527
    "henrybrad_13128", "henrydont_17599", "henryhunter_17597", "henrytravis_28300",
    "herbertjustin_20981", "herrontyler_20340", "hesterdevin_11569", "hewittralston_22078",
    "heywoodtremon_20095", "hicksCornerback_11270", "hicksjohn_17551", "hicksjordan_20594",
    "hicksmaurice_2460", "higginsrasul_13071",

    # Screenshot 103553
    "higginstee_20993", "highsmithAlex_21512", "hightowerDontae_9810", "hilljb_20595",
    "hilljoshua_17733", "hilljustinjefferson_11570", "hillkingjt_20981", "hillmarcus_2414",
    "hillmccoy_17742", "hillpatrick_2296", "hillquinton_20701", "hilltaysom_17580",
    "hilltontl_12669", "hinesnyheim_17581",

    # Screenshot 103616
    "hitchensTom_2486", "hobbsjoram_28370", "hockensonTJ_20597", "hodgesjason_20341",
    "hodginsjalen_17731", "hoegertyler_22479", "hoffmankevin_28317", "hoganChris_13202",
    "holdencole_20342", "holinsaj_22081", "hollanddarius_20999", "hollandii_1000",
    "hollierJustin_15281", "hollinsjohn_17645",

    # Screenshot 103631
    "holmanjalen_13148", "holmesjustin_22082", "holtcolby_27993", "holttorrey_28414",
    "holtsclaw_21000", "honeycuttRon_20598", "hookerkyle_20598", "hookermalik_17585",
    "hopevion_20966", "hopkinsbaby_13149", "hopkinscam_20987", "hopkinsdeandre_10866",
    "hopkinsmalik_20599", "horisberdan_20343",

    # Screenshot 103657
    "horsecollardale_2319", "horsleytim_21178", "howardaustin_22323", "howardkyle_22483",
    "howardoj_13219", "howardxavien_12588", "howellfranco_20344", "howellsam_22052",
    "howelykenji_20345", "howeybenry_22079", "hoytjr_22071", "hubbsmalcolm_11268",
    "hudsonanton_13161", "hugginskelvin_13181",

    # Screenshot 103711
    "hugheskyle_2301", "hugheslonnie_22468", "hullfrankie_28412", "humphreesliam_17587",
    "humphriesmarlon_12589", "hunleymichael_21001", "huntagildon_28295", "huntalex_20700",
    "huntcalvin_13072", "huntericbilly_28295", "hunterjustin_12654", "huntkareem_13072",
    "huntnate_20346", "huntterrace_17588",

    # Screenshot 103725
    "huntleydawson_20601", "hurdlejaven_12656", "hurdridly_17847", "hurstkayshon_20347",
    "hurtjalen_20982", "husseyjeremiah_12606", "hutebrian_28404", "hutchinsonaidan_22362",
    "hutekellen_22325", "hyattjalin_22714", "hydefrankie_28412", "hydejailen_12557",
    "hymanjamal_28341", "ianettialex_20703",

    # Screenshot 103753
    "ifedisolaoliseunla_12668", "igarrochance_21179", "ikwelikedike_21497", "ingoldsbymaxx_22484",
    "ingoldsbymax_22484", "ingra_1002", "ingramII_11590", "ingrammario_11590",
    "inocenteandre_22083", "iosivaaeneas_20988", "ironcurtistopher_22080", "irvinganthony_28412",
    "irvingbyron_17600", "isaacsemmanuel_22084",

    # Screenshot 103812
    "isleljohn_28289", "israelarthur_2439", "iyiegenimichael_21002", "jacksonadvill_2409",
    "jacksonajax_22085", "jacksoncedric_2094", "jacksondarious_13184", "jacksondeSean_17552",
    "jacksoneddie_11271", "jacksonjack_12617", "jacksonjustin_13110", "jacksonkareem_20348",
    "jacksonlachien_17600", "jacksonlamar_20349",

    # Screenshot 103827
    "jacksonmalik_20704", "jacksonquinton_21003", "jacksonrickey_20086", "jacksontj_2515",
    "jacobsadam_2525", "jacobsjacob_20600", "jacobsjosh_12610", "jacobymyers_20601",
    "jagerfisher_21575", "jamesderwin_17589", "jamesedgerrin_28448", "jamesrichie_11562",
    "jamesronnie_20601", "jamestbake_2405",

    # Screenshot 103844
    "jamisonnatrone_20602", "janettijason_20703", "janisjc_20989", "janovisgregory_28367",
    "janssengregory_20350", "jarrettgrady_13068", "jarwinblake_13150", "jasonwoodyard_22084",
    "jeffersonjustin_20983", "jeffersonvan_20994", "jefferytruman_2437", "jenkinsjaylan_21004",
    "jenkinsjeffrey_20351", "jenkinsJohnathan_17687",

    # Screenshot 103901
    "jenkinsmalcolm_11272", "jenningsbrian_28322", "jenningscolby_28322", "jenningsgabrion_20602",
    "jenningsjabril_17554", "jenningstim_11273", "jesseanthony_22480", "jeterdaniel_27992",
    "joeckeluke_494", "johannjohn_20152", "johnsonammon_20095", "johnsonandre_2517",
    "johnsonbrady_20352", "johnsonbrandin_28470",

    # Screenshot 103917
    "johnsonCalvin_9791", "johnsonchris_13185", "johnsoncolby_10867", "johnsondamien_22326",
    "johnsonderick_17733", "johnsondiontae_20603", "johnsonduke_17553", "johnsonGeorges_22086",
    "johnsonjalin_20604", "johnsonjamaal_20605", "johnsonjamarcus_2505", "johnsonkerryon_13073",
    "johnsonlonnie_10867", "johnsonmalik_2413",

    # Screenshot 103938
    "johnsonmichael_20154", "johnsonsteve_1637", "johnsontyler_13127", "johnsonzak_21514",
    "johnstondarius_22327", "jollytherell_28474", "jonathandijion_12548", "joneschristopher_12590",
    "jonescyrus_13163", "jonesdamiere_2324", "jonesdaniel_13074", "jonesdeion_11274",
    "jonesdion_17736", "jonesduke_13109",

    # Screenshot 103959
    "jonesdwight_22486", "joneseddie_28382", "jonesjosh_22087", "jonesjulio_9792",
    "jonesmac_11275", "jonesmalcolm_20606", "jonesmarvin_17555", "jonesrashod_20705",
    "jonessam_2508", "joneszack_12560", "jordanandre_2303", "jordancameron_17651",
    "jordanhayes_21534", "jordanjustin_12591",

    # Screenshot 104019
    "jordanjuwaun_22486", "josephkerby_21577", "josephlinval_11277", "jossphilippe_22481",
    "jozwijohnny_22481", "julmisted_20355", "juneaujoseph_21535", "jurkosam_2515",
    "justinSummers_22328", "juszczykKyle_11278", "kafusipatrick_20356", "kaindohAdonis_28292",
    "KamansKyle_15279", "Kamara_12670",

    # Screenshot 104059
    "kamaraAlvin_12670", "kaneDarius_17601", "kaplandalton_20995", "karrasalex_2473",
    "kavcicSteve_2320", "kayaathaurice_12559", "kayahendricks_12559", "kearse_2491",
    "kearseelishaun_12559", "keary_2491", "keebletyler_22333", "keenancole_17686",
    "keenanthomas_22089", "kelceJason_11279", "kelceTravis_11280", "kelleymalcolm_21180",
]

# Batch 3: Screenshots 105036-110210 (partially extracted from session)
pam_batch3 = [
    # Screenshot 105036
    "matthewschris_2249", "matthewsclay_20143", "matthewsJake_12349", "matthewsjordan_12350",
    "MatthewsTommy_FOTF", "mattisonAlexander_20641", "maualugarey_20077", "maxwellbyron_10788",
    "MayeDrake_14501", "mayermichael_22697", "MayfieldBaker_13117", "McBrideTrey_22093",
    "mcCaffreyChristian_12556", "McCarthyJJ_14610", "mcclaimrobert_10068", "McCloudRayRay_13362",
    "McConkeyLadd_14651",

    # Screenshot 110210 (end markers)
    "ZabelGrey_4601", "zappeBailey_22049", "zuerleinggreg_11598",
]

# Combine all batches
all_pam_names = list(set(pam_batch1 + pam_batch2 + pam_batch3))

# Write to output file
import os
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
output_file = os.path.join(project_root, "data", "PAM", "extracted_pam_names.txt")

with open(output_file, 'w', encoding='utf-8') as f:
    for pam in sorted(all_pam_names):
        f.write(pam + '\n')

print(f"Total PAM names extracted: {len(all_pam_names)}")
print(f"Saved to: {output_file}")
print(f"\nBreakdown:")
print(f"  Batch 1 (101237-102433): {len(pam_batch1)} names")
print(f"  Batch 2 (102541-104059): {len(pam_batch2)} names")
print(f"  Batch 3 (105036-110210): {len(pam_batch3)} names (partial)")
print(f"\nNote: Batch 3 is incomplete. Screenshots 104100-105000 still need manual extraction.")
