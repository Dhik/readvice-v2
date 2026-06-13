from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import StaleElementReferenceException, ElementClickInterceptedException
import pandas as pd
import time
from datetime import datetime
import traceback

def get_shop_data_for_tab(driver, tab_node_key, tab_text):
    print(f"\nProcessing data for period: {tab_text}")
    
    tab = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, f'div[data-node-key="{tab_node_key}"]'))
    )
    tab.click()
    
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, f'div[data-node-key="{tab_node_key}"].ant-tabs-tab-active'))
    )
    store_names = []
    revenues = []
    qtys = []
    average_prices = []
    tingkat_komisi = []
    creators = []
    pub_dates = []
    ratio_creators = []
    
    current_page = 1
    max_pages = 30
    
    while current_page <= max_pages:
        print(f"Processing page {current_page} for period {tab_text}")
        try:
            WebDriverWait(driver, 30).until_not(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".ant-spin-spinning"))
            )
        except:
            print("Warning: Loading spinner timeout, attempting to continue")
        try:
            table = WebDriverWait(driver, 30).until(
                EC.visibility_of_element_located((By.CSS_SELECTOR, "table"))
            )
        except:
            print("Error: Could not find table element")
            break
        time.sleep(2)
        
        try:
            rows_check = WebDriverWait(driver, 20).until(
                lambda d: len(d.find_elements(By.CSS_SELECTOR, "table > tbody > tr")) > 1
            )
            table_content = driver.find_element(By.CSS_SELECTOR, "table").get_attribute('innerHTML')
            if len(table_content) < 100:
                print("Warning: Table appears to have insufficient content. Waiting more...")
                time.sleep(5)
            
            rows = driver.find_elements(By.CSS_SELECTOR, "table > tbody > tr")
            row_count = 0
            for idx in range(1, len(rows)): 
                try:
                    row = driver.find_elements(By.CSS_SELECTOR, "table > tbody > tr")[idx]
                    cells = row.find_elements(By.CSS_SELECTOR, "td")
                    
                    if len(cells) >= 11:
                        store_name = cells[1].text.strip()
                        revenue = cells[2].text.strip()
                        qty = cells[4].text.strip()
                        avg_price = cells[5].text.strip()
                        komisi = cells[6].text.strip()
                        creator = cells[8].text.strip()
                        tgl = cells[9].text.strip()
                        ratio = cells[10].text.strip()
                        
                        if store_name and len(store_name) > 0:
                            store_names.append(store_name)
                            qtys.append(qty)
                            revenues.append(revenue)
                            average_prices.append(avg_price)
                            tingkat_komisi.append(komisi)
                            creators.append(creator)
                            pub_dates.append(tgl)
                            ratio_creators.append(ratio)
                            row_count += 1
                except StaleElementReferenceException:
                    print("Encountered stale element, refreshing elements...")
                    time.sleep(1)
                    continue
                except Exception as e:
                    print(f"Error processing row: {str(e)}")
                    continue
            
            print(f"Successfully processed {row_count} rows on page {current_page}")
            if current_page < max_pages:
                try:
                    try:
                        WebDriverWait(driver, 10).until_not(
                            EC.presence_of_element_located((By.CSS_SELECTOR, ".ant-spin-spinning"))
                        )
                    except:
                        pass
                    
                    next_buttons = driver.find_elements(By.CSS_SELECTOR, "li.ant-pagination-next")
                    if not next_buttons or "ant-pagination-disabled" in next_buttons[0].get_attribute("class"):
                        print(f"No more pages available for period {tab_text}")
                        break
                    
                    max_attempts = 3
                    for attempt in range(max_attempts):
                        try:
                            next_button = driver.find_element(By.CSS_SELECTOR, "li.ant-pagination-next:not(.ant-pagination-disabled)")
                            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", next_button)
                            time.sleep(1) 
                            
                            driver.execute_script("arguments[0].click();", next_button)
                            try:
                                WebDriverWait(driver, 5).until(
                                    EC.presence_of_element_located((By.CSS_SELECTOR, ".ant-spin-spinning"))
                                )
                                print("Page change initiated, spinner detected")
                            except:
                                print("Warning: No loading indicator seen after clicking next")
                            
                            try:
                                WebDriverWait(driver, 30).until_not(
                                    EC.presence_of_element_located((By.CSS_SELECTOR, ".ant-spin-spinning"))
                                )
                            except:
                                print("Warning: Loading spinner persisted too long")
                            old_content = table_content
                            changed = False
                            for check in range(5): 
                                time.sleep(2)
                                try:
                                    new_content = driver.find_element(By.CSS_SELECTOR, "table").get_attribute('innerHTML')
                                    if new_content != old_content and len(new_content) > 100:
                                        changed = True
                                        break
                                except:
                                    pass
                            
                            if changed:
                                print(f"Successfully changed to page {current_page + 1}")
                                current_page += 1
                                break 
                            else:
                                print(f"Page content did not change, retrying... (attempt {attempt + 1}/{max_attempts})")
                                if attempt == max_attempts - 1:
                                    print("Max retry attempts reached, ending pagination")
                                    return pd.DataFrame({
                                        'Period': tab_text,
                                        'Store_Name': store_names,
                                        'Pendapatan': revenues,
                                        'Penjualan': qtys,
                                        'Average_Price': average_prices,
                                        'Tingkat Komisi': tingkat_komisi,
                                        'Jumlah Kreator': creators,
                                        'Tanggal Publikasi': pub_dates,
                                        'Rasio Konversi Konten': ratio_creators,
                                    })
                                
                        except ElementClickInterceptedException:
                            print(f"Click intercepted, waiting and retrying (attempt {attempt + 1}/{max_attempts})")
                            time.sleep(3)  
                            try:
                                next_button = driver.find_element(By.CSS_SELECTOR, "li.ant-pagination-next")
                                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", next_button)
                                time.sleep(2)
                            except:
                                pass
                        except Exception as e:
                            print(f"Error during pagination: {str(e)}")
                            if attempt == max_attempts - 1:
                                print("Max retry attempts reached, ending pagination")
                                return pd.DataFrame({
                                    'Period': tab_text,
                                    'Store_Name': store_names,
                                    'Pendapatan': revenues,
                                    'Penjualan': qtys,
                                    'Average_Price': average_prices,
                                    'Tingkat Komisi': tingkat_komisi,
                                    'Jumlah Kreator': creators,
                                    'Tanggal Publikasi': pub_dates,
                                    'Rasio Konversi Konten': ratio_creators,
                                })
                            time.sleep(2)
                except Exception as e:
                    print(f"Error in pagination: {str(e)}")
            else:
                print(f"Reached maximum page limit ({max_pages}) for period {tab_text}")
                break
        except Exception as e:
            print(f"Error processing page {current_page}: {str(e)}")
            traceback.print_exc()
            break
    
    return pd.DataFrame({
        'Period': tab_text,
        'Store_Name': store_names,
        'Pendapatan': revenues,
        'Penjualan': qtys,
        'Average_Price': average_prices,
        'Tingkat Komisi': tingkat_komisi,
        'Jumlah Kreator': creators,
        'Tanggal Publikasi': pub_dates,
        'Rasio Konversi Konten': ratio_creators,
    })

def scrape_kalodata():
    chrome_options = Options()
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920,1080')
    chrome_options.add_argument('--disable-blink-features=AutomationControlled')
    
    driver = webdriver.Chrome(options=chrome_options)
    
    tabs_to_process = [
        ("1065281", "perawatan rambut"),
        # ("1065268", "face scrub n peel"),
        # ("1065252", "face mask"),
    ]
    
    all_data = []
    
    try:
        driver.get('https://www.kalodata.com/login')
        
        phone_input = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='text']"))
        )
        phone_input.send_keys("081295691796")
        
        password_input = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
        password_input.send_keys("Rashomon354!")
        
        login_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
        login_button.click()
        WebDriverWait(driver, 15).until(
            EC.url_contains("/explore")
        )
        print("Successfully logged in...")
        driver.get('https://www.kalodata.com/product')
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "div.ant-tabs-nav"))
        )
        
        try:
            WebDriverWait(driver, 10).until_not(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".ant-spin-spinning"))
            )
        except:
            print("Warning: Initial loading spinner persistent")
        
        for node_key, tab_text in tabs_to_process:
            try:
                data_df = get_shop_data_for_tab(driver, node_key, tab_text)
                if not data_df.empty:
                    all_data.append(data_df)
                    print(f"Successfully collected data for {tab_text} with {len(data_df)} records")
                else:
                    print(f"No data collected for {tab_text}")
            except Exception as e:
                print(f"Error processing tab {tab_text}: {str(e)}")
                traceback.print_exc()
                continue
        
        if all_data:
            final_df = pd.concat(all_data, ignore_index=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f'kalodata_product_data_august_2025_{timestamp}.csv'
            final_df.to_csv(filename, index=False)
            print(f"\nData successfully scraped and saved to {filename}")
            print(f"Total records collected: {len(final_df)}")
        else:
            print("No data was collected from any tab")
        
    except Exception as e:
        print(f"An error occurred: {str(e)}")
        traceback.print_exc()
        try:
            print(f"Current URL when error occurred: {driver.current_url}")
        except:
            print("Could not retrieve current URL")
    finally:
        driver.quit()

if __name__ == "__main__":
    scrape_kalodata()