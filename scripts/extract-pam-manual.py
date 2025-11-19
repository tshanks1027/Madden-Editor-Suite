"""
Manual extraction helper - I'll read screenshots and manually type the PAM names
This creates a comprehensive list from all visible screenshots
"""

# Based on screenshots already viewed, here are the PAM names:
pam_names = [
    # Screenshot 101237
    "abanikandaIsrael_22741",
    "abdullahAmeer_2402",
    "abramJohnathan_20459",
    "achaneDevon_22692",
    "adamsDavante_10823",
    "adamsJamal_12524",
    "addaeJahleel_9919",
    "adderleyNasir_20455",
    "addisonJordan_22693",
    "addisonMario_10984",
    "adebopaulson_21445",
    "agholorNelson_2442",
    "aguayoRoberto_17695",
    "AiyukBrandon_21069",
    "ajayjay_2400",

    # Screenshot 101250
    "akersCam_20919",
    "alexanderjaire_13109",
    "alexanderLorenzo_28291",
    "alexanderMackensie_17553",
    "alexanderMaurice_2101",
    "allegrettiNick_20724",
    "allenBrandon_17606",
    "allenBrian_13223",
    "allendwayne_11281",
    "allenjavonus_2408",
    "allenJonathan_12521",
    "allenJosh_13197",
    "AllenJosh_20410",
    "allenKeenan_505",
    "allenLarry_12223",
    "AllogierTyler_22315",

    # Screenshot 101330
    "alShaairAzeez_20688",
    "alstottMike_12232",
    "AltJoe_14694",
    "amersondavid_11893",
    "andersonDerek_26674",
    "andersonJrWill_22702",
    "andersonRobby_17960",
    "andrewsmark_13112",
    "AngerBryan_11594",
    "ansahezekiel_1121",
    "antetokounmpoGiannis_2995",
    "antetokounmpoKostas_2997",
    "antetokounmpothanasis_2996",
    "anzaloneAlex_12613",
    "appleEli_17653",
    "arcegaWhitesideJJ_20344",

    # Screenshot 101424
    "arcegaWhitesideJJ_20344",
    "armsteadArik_2533",
    "armsteadTerron_964",
    "ArroyoElijah_15119",
    "artispaynecameron_2412",
    "asamoahIIBrian_22190",
    "atkinsGeno_9867",
    "austiniicalvin_22086",
    "austinTavon_494",
    "avrilCliff_28460",
    "awuzieChidobe_12587",
    "ayersDeMarcus_17865",

    # Screenshot 102209
    "bagentTyson_22900",
    "baileychamp_1523",
    "baileyDan_10933",
    "baileyJake_20480",

    # Screenshot 103316 (gen_ entries)
    "gen_2_B_N_0013",
    "gen_2_B_N_0014",
    "gen_2_B_N_0015",
    "gen_2_B_N_0016",
    "gen_2_B_N_0017",
    "gen_2_B_N_0018",
    "gen_2_B_N_006",
    "gen_2_B_N_007",
    "gen_2_b_n_008",
    "gen_2_B_N_009",
    "gen_2_B_N_01",
    "gen_2_B_N_02",
    "gen_2_B_N_03",
    "gen_2_B_S_001",
    "gen_2_B_S_005",
    "gen_2_B_S_006",
    "gen_2_B_S_007",

    # Screenshot 105036
    "matthewschris_2249",
    "matthewsclay_20143",
    "matthewsJake_12349",
    "matthewsjordan_12350",
    "MatthewsTommy_FOTF",
    "mattisonAlexander_20641",
    "maualugarey_20077",
    "maxwellbyron_10788",
    "MayeDrake_14501",
    "mayermichael_22697",
    "MayfieldBaker_13117",
    "McBrideTrey_22093",
    "mcCaffreyChristian_12556",
    "McCarthyJJ_14610",
    "mcclaimrobert_10068",
    "McCloudRayRay_13362",
    "McConkeyLadd_14651",

    # Screenshot 110210 (end)
    "ZabelGrey_4601",
    "zappeBailey_22049",
    "zuerleinggreg_11598",
]

# I need to read ALL screenshots to get complete list
# Since I can't use OCR, I'll need to manually view all 102 screenshots
# For now, let me create a placeholder that tells the user we need all screenshots read

output_file = r"C:\Users\tshan\Documents\Dev\madden-editor-suite\data\PAM\partial_pam_list.txt"

with open(output_file, 'w', encoding='utf-8') as f:
    for pam in sorted(set(pam_names)):
        f.write(pam + '\n')

print(f"Extracted {len(set(pam_names))} PAM names from sample screenshots")
print(f"Saved to: {output_file}")
print("\nNote: This is only a partial list. Need to view all 102 screenshots for complete extraction.")
